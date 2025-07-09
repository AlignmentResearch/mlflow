import { useSearchParams } from '@mlflow/mlflow/src/common/utils/RoutingUtils';

export function useSearchFilter() {
  const name = 'experimentSearchFilter';
  const [searchParams, setSearchParams] = useSearchParams();

  const searchFilter = searchParams.get(name) ?? '';

  function setSearchFilter(searchFilter: string) {
    if (!searchFilter) {
      searchParams.delete(name);
    } else {
      searchParams.set(name, searchFilter);
    }
    setSearchParams(searchParams);
  }

  return [searchFilter, setSearchFilter] as const;
}

export function useProjectFilter() {
  const name = 'experimentProjectFilter';
  const [searchParams, setSearchParams] = useSearchParams();

  const projectFilter = searchParams.get(name) ?? '';

  function setProjectFilter(projectFilter: string) {
    if (!projectFilter) {
      searchParams.delete(name);
    } else {
      searchParams.set(name, projectFilter);
    }
    setSearchParams(searchParams);
  }

  return [projectFilter, setProjectFilter] as const;
}
