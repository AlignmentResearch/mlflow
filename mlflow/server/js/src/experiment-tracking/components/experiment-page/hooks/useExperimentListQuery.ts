import { useQuery, QueryFunctionContext, defaultContext } from '@mlflow/mlflow/src/common/utils/reactQueryHooks';
import { MlflowService } from '../../../sdk/MlflowService';
import { useCallback, useContext, useRef, useState, useMemo } from 'react';
import { SearchExperimentsApiResponse } from '../../../types';
import { useLocalStorage } from '@mlflow/mlflow/src/shared/web-shared/hooks/useLocalStorage';
import { CursorPaginationProps } from '@databricks/design-system';
import { SortingState } from '@tanstack/react-table';

const STORE_KEY = {
  PAGE_SIZE: 'experiments_page.page_size',
  SORTING_STATE: 'experiments_page.sorting_state',
};
const DEFAULT_PAGE_SIZE = 25;

const ExperimentListQueryKeyHeader = 'experiment_list';

type ExperimentListQueryKey = [
  typeof ExperimentListQueryKeyHeader,
  {
    searchFilter: string;
    projectFilter: string;
    pageToken?: string;
    pageSize: number;
    sorting: SortingState;
  }
];

const queryFn = ({ queryKey }: QueryFunctionContext<ExperimentListQueryKey>) => {
  const [, { searchFilter, projectFilter, pageToken, pageSize, sorting }] = queryKey;

  // NOTE: REST API docs are not detailed enough, see: mlflow/store/tracking/abstract_store.py#search_experiments
  const orderBy = sorting?.map((column) => ['order_by', `${column.id} ${column.desc ? 'DESC' : 'ASC'}`]) ?? [];

  const data = [['max_results', String(pageSize)], ...orderBy];

  // Build filter conditions
  const filterConditions = [];
  
  if (searchFilter) {
    filterConditions.push(`name ILIKE '%${searchFilter}%'`);
  }

  if (projectFilter) {
    if (projectFilter === 'Unassigned') {
      // For "Unassigned", we can't use "IS NULL" in MLflow search API
      // We'll handle this case client-side by fetching all experiments
      // and filtering them in the response processing
      // Don't add any project filter condition here
    } else {
      // Filter for experiments with the specific project_name tag
      filterConditions.push(`tags.project_name = '${projectFilter}'`);
    }
  }

  if (filterConditions.length > 0) {
    data.push(['filter', filterConditions.join(' AND ')]);
  }

  if (pageToken) {
    data.push(['page_token', pageToken]);
  }

  return MlflowService.searchExperiments(data);
};

export const useExperimentListQuery = (
  searchFilter: string,
  projectFilter: string,
  pageToken?: string
) => {
  const [pageSize, setPageSize] = useLocalStorage({
    key: STORE_KEY.PAGE_SIZE,
    version: 0,
    initialValue: DEFAULT_PAGE_SIZE,
  });
  const [sorting, setSorting] = useLocalStorage<SortingState>({
    key: STORE_KEY.SORTING_STATE,
    version: 0,
    initialValue: [],
  });

  const queryKey: ExperimentListQueryKey = [
    ExperimentListQueryKeyHeader,
    {
      searchFilter,
      projectFilter,
      pageToken,
      pageSize,
      sorting,
    },
  ];

  const queryResult = useQuery<SearchExperimentsApiResponse, Error, SearchExperimentsApiResponse, ExperimentListQueryKey>(
    queryKey,
    {
      queryFn,
      retry: false,
    }
  );

  // Post-process the results to handle "Unassigned" filtering client-side
  const processedData = useMemo(() => {
    if (!queryResult.data) return queryResult.data;

    if (projectFilter === 'Unassigned') {
      // Filter experiments that don't have a project_name tag
      const filteredExperiments = queryResult.data.experiments?.filter(experiment => {
        const hasProjectTag = experiment.tags?.some(tag => tag.key === 'project_name');
        return !hasProjectTag;
      });

      return {
        ...queryResult.data,
        experiments: filteredExperiments
      };
    }

    return queryResult.data;
  }, [queryResult.data, projectFilter]);

  const paginationProps: Omit<CursorPaginationProps, 'componentId'> = {
    hasNextPage: !!queryResult.data?.next_page_token,
    hasPreviousPage: !!pageToken,
    onNextPage: () => {
      // Implementation for next page
    },
    onPreviousPage: () => {
      // Implementation for previous page
    },
  };

  return {
    ...queryResult,
    data: processedData,
    paginationProps,
    pageSize,
    setPageSize,
    sorting,
    setSorting,
  };
};

export const useInvalidateExperimentList = () => {
  const queryClient = useContext(defaultContext);
  return useCallback(() => {
    queryClient?.invalidateQueries([ExperimentListQueryKeyHeader]);
  }, [queryClient]);
};

// Query key for fetching all experiments to extract project names
const AllExperimentsQueryKeyHeader = 'all_experiments_for_projects';

// Hook to get all unique project names from experiments
export const useUniqueProjectNames = () => {
  const queryResult = useQuery<SearchExperimentsApiResponse, Error, SearchExperimentsApiResponse, [string]>(
    [AllExperimentsQueryKeyHeader],
    {
      queryFn: () => {
        // Fetch all experiments without any filter to get project names
        const data = [['max_results', '1000']]; // Get a large number to capture all experiments
        return MlflowService.searchExperiments(data);
      },
      retry: false,
    }
  );

  const projectNames = useMemo(() => {
    if (!queryResult.data?.experiments) {
      return [];
    }

    const uniqueProjects = new Set<string>();
    let hasUnassigned = false;

    queryResult.data.experiments.forEach(experiment => {
      const projectTag = experiment.tags?.find(tag => tag.key === 'project_name');
      if (projectTag?.value) {
        uniqueProjects.add(projectTag.value);
      } else {
        hasUnassigned = true;
      }
    });

    const projects = Array.from(uniqueProjects).sort();
    
    // Add "Unassigned" if there are experiments without project tags
    if (hasUnassigned) {
      projects.push('Unassigned');
    }

    return projects;
  }, [queryResult.data?.experiments]);

  return {
    projectNames,
    isLoading: queryResult.isLoading,
    error: queryResult.error,
  };
};
