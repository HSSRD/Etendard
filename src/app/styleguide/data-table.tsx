// DataTable dans chacun de ses états (ADR 0016) : texte et statuts, puis prix datés.
import DataTable from '@/components/DataTable';
import demo from '@/content/demo-projet';
import StyleguideStates from '@/layouts/StyleguideStates';
import type { Table } from '@/lib/validate-project-pages';

const tables = demo.pages
  .flatMap((page) => page.sections)
  .flatMap((section) => section.blocks)
  .filter((block): block is Table => block.type === 'table');

export default function DataTablePage() {
  return (
    <StyleguideStates
      name="DataTable"
      description="Composant DataTable d’Étendard : un tableau, en liste sur un écran étroit."
      states={tables.map((table) => ({
        label: `Tableau « ${table.caption} »`,
        node: <DataTable table={table} />,
      }))}
    />
  );
}
