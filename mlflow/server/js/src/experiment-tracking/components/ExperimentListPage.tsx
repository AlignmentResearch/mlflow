import ExperimentListView from './ExperimentListView';
import { useSearchFilter, useProjectFilter } from './experiment-page/hooks/useSearchFilter';

const ExperimentListPage = () => {
  const [searchFilter, setSearchFilter] = useSearchFilter();
  const [projectFilter, setProjectFilter] = useProjectFilter();

  return <ExperimentListView searchFilter={searchFilter} setSearchFilter={setSearchFilter} projectFilter={projectFilter} setProjectFilter={setProjectFilter} />;
};

export default ExperimentListPage;
