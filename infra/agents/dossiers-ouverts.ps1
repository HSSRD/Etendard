# Liste les dossiers de Flo que le compte etendard-agent peut modifier par un groupe dont il est membre (ADR 0008, #70).
# Usage : powershell -NoProfile -ExecutionPolicy Bypass -File infra/agents/dossiers-ouverts.ps1 [-Corriger]
# Sans option : n'écrit rien, affiche un dossier par ligne (rien si tout est fermé). -Corriger (admin) : retire ces
# groupes de chaque dossier listé et y donne l'écriture à Flo ; au premier niveau, les Utilisateurs gardent la lecture,
# plus bas seulement celle héritée du parent (aucune dans un dossier réservé à Flo).
# Sont signalés : un dossier du premier niveau de C:\, D:\ et E:\ (hors dossiers système) dont une règle, héritée ou
# non, donne l'écriture à ces groupes ; plus bas, un dossier dont une règle explicite la donne (C:\01-Steam,
# lanceurs de jeux…) : corriger le parent ne la retire pas, et le compte agent y accède par son chemin.
param([switch]$Corriger)

# Tout le monde, Batch (tâches planifiées), Interactif, Utilisateurs authentifiés, Utilisateurs.
$groupes = 'S-1-1-0', 'S-1-5-3', 'S-1-5-4', 'S-1-5-11', 'S-1-5-32-545'
# Écriture, ajout, attributs, suppression, permissions, propriétaire, GENERIC_WRITE, GENERIC_ALL.
$ecriture = 0x500D0156
$systeme = 'Windows', 'Users', 'ProgramData', 'Program Files', 'Program Files (x86)', 'WindowsApps', 'WpSystem',
  'XboxGames', 'Recovery', 'Documents and Settings', 'EtendardAgent'

function Test-Ouvert([string]$chemin, [bool]$herites) {
  try { $acl = Get-Acl -LiteralPath $chemin -ErrorAction Stop } catch { return $false }
  foreach ($r in $acl.GetAccessRules($true, $herites, [Security.Principal.SecurityIdentifier])) {
    if ($r.AccessControlType -eq 'Allow' -and $groupes -contains $r.IdentityReference.Value -and
      ([int64]$r.FileSystemRights -band $ecriture)) { return $true }
  }
  $false
}

$racines = foreach ($disque in 'C:\', 'D:\', 'E:\') {
  if (-not (Test-Path -LiteralPath $disque)) { continue }
  Get-ChildItem -LiteralPath $disque -Directory -Force -ErrorAction SilentlyContinue | Where-Object {
    $_.Name -notlike '$*' -and $_.Name -ne 'System Volume Information' -and
    -not ($disque -eq 'C:\' -and $systeme -contains $_.Name)
  }
}

$ouverts = New-Object System.Collections.Generic.List[object]
foreach ($racine in $racines) {
  if (Test-Ouvert $racine.FullName $true) { $ouverts.Add(@{ Chemin = $racine.FullName; Racine = $true }) }
  # Parcours sans suivre les jonctions ni les liens symboliques (boucles, dossiers hors du disque).
  $pile = New-Object System.Collections.Generic.Stack[System.IO.DirectoryInfo]
  $pile.Push($racine)
  while ($pile.Count) {
    $dossier = $pile.Pop()
    try { $enfants = $dossier.GetDirectories() } catch { continue }
    foreach ($enfant in $enfants) {
      if ($enfant.Attributes -band [IO.FileAttributes]::ReparsePoint) { continue }
      if (Test-Ouvert $enfant.FullName $false) { $ouverts.Add(@{ Chemin = $enfant.FullName; Racine = $false }) }
      $pile.Push($enfant)
    }
  }
}

# Les dossiers du premier niveau passent avant leurs sous-dossiers : ces derniers héritent du parent déjà corrigé.
foreach ($d in $ouverts) {
  if ($Corriger) {
    # Au premier niveau, les droits hérités du disque deviennent explicites pour qu'on puisse retirer ceux des groupes.
    if ($d.Racine) { icacls $d.Chemin /inheritance:d /Q | Out-Null }
    icacls $d.Chemin /grant 'floxf:(OI)(CI)F' /Q | Out-Null
    icacls $d.Chemin /remove:g *S-1-1-0 *S-1-5-3 *S-1-5-4 *S-1-5-11 *S-1-5-32-545 /Q | Out-Null
    if ($d.Racine) { icacls $d.Chemin /grant '*S-1-5-32-545:(OI)(CI)RX' /Q | Out-Null }
  }
  $d.Chemin
}
