import React, { useState } from 'react';
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
  const {
    data: experiments,
    isLoading,
    error,
    hasNextPage,
    hasPreviousPage,
    onNextPage,
    onPreviousPage,
    pageSizeSelect,
    sorting,
    setSorting,
  } = useExperimentListQuery({ searchFilter, projectFilter });
  const invalidateExperimentList = useInvalidateExperimentList();

  const { projectNames, isLoading: isLoadingProjects } = useUniqueProjectNames();

  const { EditTagsModal, showEditExperimentTagsModal } = useUpdateExperimentTags({
    onSuccess: invalidateExperimentList,
  });

  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [searchInput, setSearchInput] = useState('');
  const [showCreateExperimentModal, setShowCreateExperimentModal] = useState(false);
  const [showBulkDeleteExperimentModal, setShowBulkDeleteExperimentModal] = useState(false);

  const handleSearchInputChange: React.ChangeEventHandler<HTMLInputElement> = (event) => {
    setSearchInput(event.target.value);
  };

  const handleSearchSubmit = () => {
    setSearchFilter(searchInput);
  };

  const handleSearchClear = () => {
    setSearchFilter('');
  };

  const handleProjectFilterChange = ({ target }: { target: { value: string } }) => {
    setProjectFilter(target.value);
  };

  const handleCreateExperiment = () => {
    setShowCreateExperimentModal(true);
  };

  const handleCloseCreateExperimentModal = () => {
    setShowCreateExperimentModal(false);
  };

  const pushExperimentRoute = () => {
    const route = Routes.getCompareExperimentsPageRoute(checkedKeys);
    navigate(route);
  };

  const checkedKeys = Object.entries(rowSelection)
    .filter(([_, value]) => value)
    .map(([key, _]) => key);

  const { theme } = useDesignSystemTheme();
  const navigate = useNavigate();
  const intl = useIntl();

  // Get the experiment objects for the checked keys
  const selectedExperiments = (experiments || []).filter(({ experimentId }) => checkedKeys.includes(experimentId));

  return (
    <ScrollablePageWrapper css={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <Spacer shrinks={false} />
      <Header
        title={<FormattedMessage defaultMessage="Experiments" description="Header title for the experiments page" />}
        buttons={
          <>
            <Button
              componentId="mlflow.experiment_list_view.new_experiment_button"
              type="primary"
              onClick={handleCreateExperiment}
              data-testid="create-experiment-button"
            >
              <FormattedMessage
                defaultMessage="Create"
                description="Label for the create experiment action on the experiments list page"
              />
            </Button>
            <Button
              componentId="mlflow.experiment_list_view.compare_experiments_button"
              onClick={pushExperimentRoute}
              data-testid="compare-experiment-button"
              disabled={checkedKeys.length < 2}
            >
              <FormattedMessage
                defaultMessage="Compare"
                description="Label for the compare experiments action on the experiments list page"
              />
            </Button>
            <Button
              componentId="mlflow.experiment_list_view.bulk_delete_button"
              onClick={() => setShowBulkDeleteExperimentModal(true)}
              data-testid="delete-experiments-button"
              disabled={checkedKeys.length < 1}
              danger
            >
              <FormattedMessage
                defaultMessage="Delete"
                description="Label for the delete experiments action on the experiments list page"
              />
            </Button>
          </>
        }
      />
      <Spacer shrinks={false} />
      {error && (
        <Alert
          css={{ marginBlockEnd: theme.spacing.sm }}
          type="error"
          message={
            error instanceof ErrorWrapper
              ? error.getMessageField()
              : error.message || (
                  <FormattedMessage
                    defaultMessage="A network error occurred."
                    description="Error message for generic network error"
                  />
                )
          }
          componentId="mlflow.experiment_list_view.error"
          closable={false}
        />
      )}
      <div css={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <TableFilterLayout>
          <div css={{ display: 'flex', gap: theme.spacing.sm, alignItems: 'center' }}>
            <div css={{ minWidth: 200 }}>
              {isLoadingProjects ? (
                <div css={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: theme.spacing.sm }}>
                  <Spinner size="small" />
                </div>
              ) : (
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
                    {intl.formatMessage({ defaultMessage: 'All Projects', description: 'Option to show all projects' })}
                  </SimpleSelectOption>
                  {projectNames.map(name => (
                    <SimpleSelectOption key={name} value={name}>
                      {name}
                    </SimpleSelectOption>
                  ))}
                </SimpleSelect>
              )}
            </div>
            <TableFilterInput
              data-testid="search-experiment-input"
              placeholder={intl.formatMessage({
                defaultMessage: 'Filter experiments by name',
                description: 'Placeholder text inside experiments search bar',
              })}
              componentId="mlflow.experiment_list_view.search"
              defaultValue={searchFilter}
              onChange={handleSearchInputChange}
              onSubmit={handleSearchSubmit}
              onClear={handleSearchClear}
              showSearchButton
            />
          </div>
        </TableFilterLayout>
        <ExperimentListTable
          experiments={experiments}
          isLoading={isLoading}
          isFiltered={Boolean(searchFilter || projectFilter)}
          rowSelection={rowSelection}
          setRowSelection={setRowSelection}
          cursorPaginationProps={{
            hasNextPage,
            hasPreviousPage,
            onNextPage,
            onPreviousPage,
            pageSizeSelect,
          }}
          sortingProps={{ sorting, setSorting }}
          onEditTags={showEditExperimentTagsModal}
        />
      </div>
      <CreateExperimentModal
        isOpen={showCreateExperimentModal}
        onClose={handleCloseCreateExperimentModal}
        onExperimentCreated={invalidateExperimentList}
      />
      <BulkDeleteExperimentModal
        isOpen={showBulkDeleteExperimentModal}
        onClose={() => setShowBulkDeleteExperimentModal(false)}
        experiments={selectedExperiments}
        onExperimentsDeleted={() => {
          invalidateExperimentList();
          setRowSelection({});
        }}
      />
      {EditTagsModal}
    </ScrollablePageWrapper>
  );
};

export default ExperimentListView;
