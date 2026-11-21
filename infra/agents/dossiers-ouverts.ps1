# Liste les dossiers de Flo que le compte etendard-agent peut modifier par un groupe dont il est membre (ADR 0008, #70).
# Usage : powershell -NoProfile -ExecutionPolicy Bypass -File infra/agents/dossiers-ouverts.ps1 [-Corriger]
# Sans option : n'écrit rien, affiche un dossier par ligne (rien si tout est fermé). -Corriger (admin) : retire ces
# groupes de chaque dossier listé et y donne l'écriture à Flo ; au premier niveau, les Utilisateurs gardent la lecture,
# plus bas seulement celle héritée du parent (aucune dans un dossier réservé à Flo).
# Sont signalés : un dossier du premier niveau d'un disque local (hors dossiers système et Store, sur tout disque) dont une règle, héritée ou
# non, donne l'écriture à ces groupes ; plus bas, un dossier dont une règle explicite la donne (C:\01-Steam,
# lanceurs de jeux…) : corriger le parent ne la retire pas, et le compte agent y accède par son chemin.
param([switch]$Corriger)

# Tout le monde, Batch (tâches planifiées), Interactif, Utilisateurs authentifiés, Utilisateurs.
$groupes = 'S-1-1-0', 'S-1-5-3', 'S-1-5-4', 'S-1-5-11', 'S-1-5-32-545'
# Écriture, ajout, attributs, suppression, permissions, propriétaire, GENERIC_WRITE, GENERIC_ALL.
$ecriture = 0x500D0156
$systeme = 'Windows', 'Users', 'ProgramData', 'Program Files', 'Program Files (x86)', 'WindowsApps', 'WpSystem',
  'XboxGames', 'Recovery', 'Documents and Settings', 'EtendardAgent'

function Test-Ouvert([IO.DirectoryInfo]$dossier, [bool]$herites) {
  # GetAccessControl plutôt que Get-Acl : six fois plus rapide, sur des centaines de milliers de dossiers.
  try { $acl = $dossier.GetAccessControl([Security.AccessControl.AccessControlSections]::Access) } catch { return $false }
  foreach ($r in $acl.GetAccessRules($true, $herites, [Security.Principal.SecurityIdentifier])) {
    if ($r.AccessControlType -eq 'Allow' -and $groupes -contains $r.IdentityReference.Value -and
      ([int64]$r.FileSystemRights -band $ecriture)) { return $true }
  }
  $false
}

# Tous les disques locaux, y compris un disque ajouté après la mise en place.
$disques = [IO.DriveInfo]::GetDrives() | Where-Object { $_.DriveType -eq 'Fixed' } | ForEach-Object { $_.Name }
$racines = foreach ($disque in $disques) {
  Get-ChildItem -LiteralPath $disque -Directory -Force -ErrorAction SilentlyContinue | Where-Object {
    $_.Name -notlike '$*' -and $_.Name -ne 'System Volume Information' -and $systeme -notcontains $_.Name
  }
}

$ouverts = New-Object System.Collections.Generic.List[object]
foreach ($racine in $racines) {
  if (Test-Ouvert $racine $true) { $ouverts.Add(@{ Chemin = $racine.FullName; Racine = $true }) }
  # Parcours sans suivre les jonctions ni les liens symboliques (boucles, dossiers hors du disque).
  $pile = New-Object System.Collections.Generic.Stack[System.IO.DirectoryInfo]
  $pile.Push($racine)
  while ($pile.Count) {
    $dossier = $pile.Pop()
    try { $enfants = $dossier.GetDirectories() } catch { continue }
    foreach ($enfant in $enfants) {
      if ($enfant.Attributes -band [IO.FileAttributes]::ReparsePoint) { continue }
      if (Test-Ouvert $enfant $false) { $ouverts.Add(@{ Chemin = $enfant.FullName; Racine = $false }) }
      $pile.Push($enfant)
    }
  }
}

# Les dossiers du premier niveau passent avant leurs sous-dossiers : ces derniers héritent du parent déjà corrigé.
$echecs = 0
foreach ($d in $ouverts) {
  if ($Corriger) {
    # Au premier niveau, les droits hérités du disque deviennent explicites pour qu'on puisse retirer ceux des groupes.
    $etapes = @(@('/grant', 'floxf:(OI)(CI)F'), @(@('/remove:g') + ($groupes | ForEach-Object { "*$_" })))
    if ($d.Racine) { $etapes = @(, @('/inheritance:d')) + $etapes + @(, @('/grant', '*S-1-5-32-545:(OI)(CI)RX')) }
    $ok = $true
    foreach ($etape in $etapes) {
      icacls $d.Chemin @etape /Q | Out-Null
      if ($LASTEXITCODE -ne 0) { $ok = $false; break }
    }
    if (-not $ok) { Write-Error "non corrigé (icacls en échec, PowerShell administrateur ?) : $($d.Chemin)" -ErrorAction Continue; $echecs++; continue }
  }
  $d.Chemin
}
if ($echecs) { exit 1 }
