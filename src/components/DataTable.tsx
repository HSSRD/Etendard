// Tableau accessible (ADR 0016) : rôles ARIA table, row, columnheader et cell.
// Rendu en liste par défaut (chaque ligne en bloc, chaque cellule précédée du nom de sa colonne),
// comme sur iOS et Android ; sur le web, la feuille web-css.ts le passe en tableau quand son
// conteneur a la place de toutes ses colonnes (requête de conteneur, sans largeur de fenêtre).
import { useId } from 'react';
import { Text, View } from 'react-native';
import { formatPrice } from '@/lib/project-pages';
import type { Cell, Table } from '@/lib/validate-project-pages';
import { themedStyles } from '@/theme/theme';
import { borderWidth, fontWeight, space } from '@/theme/tokens';
import { useTypography } from '@/theme/typography';
import StatusBadge from './StatusBadge';

function CellValue({ cell }: { cell: Cell }) {
  const typography = useTypography();
  if (typeof cell === 'string')
    return <Text style={typography.body}>{cell}</Text>;
  if (cell.status) return <StatusBadge status={cell.status} />;
  return (
    <Text style={typography.body}>{cell.price && formatPrice(cell.price)}</Text>
  );
}

export default function DataTable({ table }: { table: Table }) {
  const styles = useStyles();
  const typography = useTypography();
  const caption = useId();
  const label = [typography.body, styles.label];
  return (
    <View
      dataSet={{ columns: String(table.columns.length) }}
      style={styles.wrapper}
    >
      <Text id={caption} style={label}>
        {table.caption}
      </Text>
      <View role="table" aria-labelledby={caption}>
        <View
          role="row"
          dataSet={{ tableHead: '' }}
          style={[styles.row, styles.head]}
        >
          {table.columns.map((column) => (
            <View
              role="columnheader"
              key={column}
              dataSet={{ cell: '' }}
              style={styles.cell}
            >
              <Text style={label}>{column}</Text>
            </View>
          ))}
        </View>
        {table.rows.map((row, rowIndex) => (
          <View role="row" key={rowIndex} style={styles.row}>
            {row.map((cell, index) => (
              <View
                role="cell"
                key={index}
                dataSet={{ cell: '' }}
                style={styles.cell}
              >
                <Text dataSet={{ cellLabel: '' }} style={label}>
                  {table.columns[index]}
                  {'\u00a0:'}
                </Text>
                <View style={styles.value}>
                  <CellValue cell={cell} />
                </View>
              </View>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

const useStyles = themedStyles((colors) => ({
  wrapper: { rowGap: space[2] },
  label: { fontWeight: fontWeight.bold },
  // En liste, l'en-tête est caché : chaque cellule porte le nom de sa colonne.
  head: { display: 'none' },
  row: {
    borderTopColor: colors.border,
    borderTopWidth: borderWidth,
    columnGap: space[4],
    paddingVertical: space[2],
    rowGap: space[1],
  },
  cell: {
    alignItems: 'flex-start',
    columnGap: space[2],
    flexDirection: 'row',
    flexWrap: 'wrap',
    minWidth: 0,
  },
  value: { flexShrink: 1, minWidth: 0 },
}));
