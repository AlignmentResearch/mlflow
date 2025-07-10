import React, { useState, useCallback } from 'react';
import { Theme } from '@emotion/react';
import {
  Button,
  TableFilterLayout,
  TableFilterInput,
  Spacer,
  Header,
  Alert,
  useDesignSystemTheme,
  SimpleSelect,
  SimpleSelectOption,
  Spinner,
} from '@databricks/design-system';
import 'react-virtualized/styles.css';
import Routes from '../routes';
import { CreateExperimentModal } from './modals/CreateExperimentModal';
import { useExperimentListQuery, useUniqueProjectNames, useInvalidateExperimentList } from './experiment-page/hooks/useExperimentListQuery';
import { RowSelectionState } from '@tanstack/react-table';
import { FormattedMessage, useIntl } from 'react-intl';
import { ScrollablePageWrapper } from '../../common/components/ScrollablePageWrapper';
import { ExperimentListTable } from './ExperimentListTable';
import { useNavigate } from '../../common/utils/RoutingUtils';
import { BulkDeleteExperimentModal } from './modals/BulkDeleteExperimentModal';
import { ErrorWrapper } from '../../common/utils/ErrorWrapper';
import { useUpdateExperimentTags } from './experiment-page/hooks/useUpdateExperimentTags';

type Props = {
  searchFilter: string;
  setSearchFilter: (searchFilter: string) => void;
  projectFilter: string;
  setProjectFilter: (projectFilter: string) => void;
};

export const ExperimentListView = ({ searchFilter, setSearchFilter, projectFilter, setProjectFilter }: Props) => {
  const { data, isLoading, error, paginationProps, pageSize, setPageSize, sorting, setSorting } = useExperimentListQuery(searchFilter, projectFilter);
  const { projectNames, isLoading: isLoadingProjects } = useUniqueProjectNames();
  const invalidateExperimentList = useInvalidateExperimentList();

  const { EditTagsModal, showEditExperimentTagsModal } = useUpdateExperimentTags({
    onSuccess: invalidateExperimentList,
  });

  const handleRefetch = useCallback(() => {
    invalidateExperimentList();
  }, [invalidateExperimentList]);

  const handleProjectFilterChange = useCallback((e: any) => {
    setProjectFilter(e.target.value);
  }, [setProjectFilter]);

  const experimentsData = data?.experiments || [];
  const experimentIds = experimentsData.map((e) => e.experimentId);
  const [selectedExperimentIds, setSelectedExperimentIds] = useState<RowSelectionState>({});
  const [showBulkDeleteExperimentModal, setShowBulkDeleteExperimentModal] = useState(false);

  const handleBulkDeleteExperiments = useCallback(() => {
    const selectedIds = Object.keys(selectedExperimentIds).filter((id) => selectedExperimentIds[id]);
    const selectedExperiments = experimentsData.filter((exp) => selectedIds.includes(exp.experimentId));
    setShowBulkDeleteExperimentModal(true);
  }, [selectedExperimentIds, experimentsData]);

  const handleExperimentSelectionChange = useCallback((experimentIds: string[]) => {
    const newSelectionState: RowSelectionState = {};
    experimentIds.forEach((id) => {
      newSelectionState[id] = true;
    });
    setSelectedExperimentIds(newSelectionState);
  }, []);

  const [searchInput, setSearchInput] = useState('');
  const [showCreateExperimentModal, setShowCreateExperimentModal] = useState(false);

  const handleRefresh = () => {
    handleRefetch();
  };

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInput(e.target.value);
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setSearchFilter('');
  };

  const handleCreateExperiment = () => {
    setShowCreateExperimentModal(true);
  };

  const handleCloseCreateExperimentModal = () => {
    setShowCreateExperimentModal(false);
  };

  const checkedKeys = Object.entries(selectedExperimentIds)
    .filter(([_, value]) => value)
    .map(([key, _]) => key);

  const theme = useDesignSystemTheme();
  const navigate = useNavigate();
  const intl = useIntl();

  const pushExperimentRoute = () => {
    const route = Routes.getCompareExperimentsPageRoute(checkedKeys);
    navigate(route);
  };

  const hasSelectedExperiments = Object.values(selectedExperimentIds).some(Boolean);

  // Get the experiment objects for the checked keys
  const selectedExperiments = (experimentsData || []).filter(({ experimentId }) => checkedKeys.includes(experimentId));

  return (
    <ScrollablePageWrapper>
      <div css={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div
          css={{
            paddingBottom: 8,
            paddingTop: 8,
            gap: 16,
          }}
        >
          <Header
            title=""
            breadcrumbs={[
              <FormattedMessage
                key="experiments"
                defaultMessage="Experiments"
                description="Breadcrumb item referring to the experiments page"
              />,
            ]}
            buttons={[
              <Button
                componentId="mlflow.experiment_list_view.create_button"
                key="create"
                data-testid="create-experiment-button"
                onClick={handleCreateExperiment}
                type="primary"
              >
                <FormattedMessage
                  defaultMessage="Create"
                  description="Button to create a new experiment"
                />
              </Button>,
            ]}
          />
        </div>
        <div css={{ flex: 1, overflow: 'hidden' }}>
          <TableFilterLayout
            actions={
              <div css={{ display: 'flex', gap: 8 }}>
                <Button
                  componentId="mlflow.experiment_list_view.refresh_button"
                  onClick={handleRefresh}
                  disabled={isLoading}
                >
                  <FormattedMessage
                    defaultMessage="Refresh"
                    description="Button to refresh the experiments list"
                  />
                </Button>
                {(searchFilter || projectFilter) && (
                  <Button
                    componentId="mlflow.experiment_list_view.clear_filters_button"
                    onClick={() => {
                      setSearchFilter('');
                      setProjectFilter('');
                    }}
                  >
                    <FormattedMessage
                      defaultMessage="Clear Filters"
                      description="Button to clear all filters"
                    />
                  </Button>
                )}
              </div>
            }
          >
            <div css={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
              <SimpleSelect
                componentId="mlflow.experiment_list_view.project_filter"
                id="project-filter-dropdown"
                value={projectFilter}
                placeholder={intl.formatMessage({
                  defaultMessage: 'Filter by project',
                  description: 'Placeholder for project filter dropdown',
                })}
                onChange={handleProjectFilterChange}
                data-testid="project-filter-dropdown"
                disabled={isLoadingProjects}
              >
                <SimpleSelectOption value="">
                  <FormattedMessage
                    defaultMessage="All Projects"
                    description="Option to show all projects"
                  />
                </SimpleSelectOption>
                {projectNames.map((project) => (
                  <SimpleSelectOption key={project} value={project}>
                    {project}
                  </SimpleSelectOption>
                ))}
              </SimpleSelect>
              <TableFilterInput
                componentId="mlflow.experiment_list_view.name_filter"
                placeholder={intl.formatMessage({
                  defaultMessage: 'Filter experiments by name',
                  description: 'Placeholder for experiment name filter input',
                })}
                value={searchInput}
                onChange={handleSearchInputChange}
                onClear={handleClearSearch}
              />
            </div>
            {/* Loading state */}
            {isLoading && (
              <div css={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <Spinner size="small" />
                <FormattedMessage
                  defaultMessage="Loading experiments..."
                  description="Loading message for experiments"
                />
              </div>
            )}
            {/* Error state */}
            {error && (
              <Alert
                componentId="mlflow.experiment_list_view.error_alert"
                type="error"
                message={error.message}
                css={{ marginBottom: 16 }}
              />
            )}
            {/* Result count */}
            {!isLoading && !error && (
              <div css={{ marginBottom: 16, color: '#666' }}>
                <FormattedMessage
                  defaultMessage="{count} {count, plural, one {experiment} other {experiments}}"
                  description="Count of experiments shown"
                  values={{ count: experimentsData?.length || 0 }}
                />
                {(searchFilter || projectFilter) && (
                  <FormattedMessage
                    defaultMessage=" (filtered)"
                    description="Indicator that results are filtered"
                  />
                )}
              </div>
            )}
          </TableFilterLayout>
          <ExperimentListTable
            experiments={experimentsData}
            isLoading={isLoading}
            isFiltered={Boolean(searchFilter || projectFilter)}
            rowSelection={selectedExperimentIds}
            setRowSelection={setSelectedExperimentIds}
            cursorPaginationProps={paginationProps}
            sortingProps={{ sorting, setSorting }}
            onEditTags={showEditExperimentTagsModal}
          />
        </div>
      </div>
      <CreateExperimentModal
        isOpen={showCreateExperimentModal}
        onClose={handleCloseCreateExperimentModal}
        onExperimentCreated={handleRefetch}
      />
      <BulkDeleteExperimentModal
        isOpen={showBulkDeleteExperimentModal}
        onClose={() => setShowBulkDeleteExperimentModal(false)}
        experiments={selectedExperiments}
        onExperimentsDeleted={handleRefetch}
      />
      {EditTagsModal}
    </ScrollablePageWrapper>
  );
};

export default ExperimentListView;
