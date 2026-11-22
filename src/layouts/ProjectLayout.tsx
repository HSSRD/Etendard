// Page d'un projet (ADR 0016) : header et footer du site, en-tête du projet, navigation entre ses
// pages, puis les sections. Chaque route de src/app/projets/ ne fait que lui passer son contenu,
// et ses figures s'il y en a.
import type { ReactNode } from 'react';
import { View } from 'react-native';
import ProjectHeader from '@/components/ProjectHeader';
import ProjectNav from '@/components/ProjectNav';
import ProjectSection from '@/components/ProjectSection';
import SiteFooter from '@/components/SiteFooter';
import SiteHeader from '@/components/SiteHeader';
import { AnchorTarget } from '@/lib/anchors';
import type { ProjectMeta, ProjectPage } from '@/lib/validate-project-pages';
import BaseLayout from './BaseLayout';
import { pageStyles } from './page-styles';

interface Props {
  project: ProjectMeta;
  page: ProjectPage;
  /** Figure de chaque section qui en a une, par id de section. */
  figures?: Partial<Record<string, ReactNode>>;
}

export default function ProjectLayout({ project, page, figures }: Props) {
  const title = [page.title, page.slug && project.title, 'Étendard']
    .filter(Boolean)
    .join(' — ');
  return (
    <BaseLayout
      title={title}
      description={page.description}
      header={<SiteHeader home="/" />}
      footer={<SiteFooter top="#haut" />}
    >
      <View style={[pageStyles.column, pageStyles.page]}>
        <AnchorTarget id="haut">
          <ProjectHeader project={project} page={page} />
        </AnchorTarget>
        <ProjectNav project={project} current={page.slug} />
        {page.sections.map((section) => (
          <ProjectSection
            key={section.id}
            section={section}
            repo={project.repo}
            figure={figures?.[section.id]}
          />
        ))}
      </View>
    </BaseLayout>
  );
}
