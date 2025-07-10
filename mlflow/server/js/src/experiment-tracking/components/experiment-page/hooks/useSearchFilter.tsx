import { useSearchParams } from '@mlflow/mlflow/src/common/utils/RoutingUtils';
import { useLocalStorage } from '@mlflow/mlflow/src/shared/web-shared/hooks/useLocalStorage';

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
  const urlParamName = 'experimentProjectFilter';
  const [searchParams, setSearchParams] = useSearchParams();

  // Use localStorage for persistence across sessions
  const [persistedProjectFilter, setPersistedProjectFilter] = useLocalStorage({
    key: 'experiments_page.project_filter',
    version: 0,
    initialValue: '',
  });

  // Get project filter from URL first, then fallback to localStorage
  const urlProjectFilter = searchParams.get(urlParamName);
  const projectFilter = urlProjectFilter ?? persistedProjectFilter;

  function setProjectFilter(projectFilter: string) {
    // Update URL parameter
    if (!projectFilter) {
      searchParams.delete(urlParamName);
    } else {
      searchParams.set(urlParamName, projectFilter);
    }
    setSearchParams(searchParams);
    
    // Also persist to localStorage
    setPersistedProjectFilter(projectFilter);
  }

  return [projectFilter, setProjectFilter] as const;
}
