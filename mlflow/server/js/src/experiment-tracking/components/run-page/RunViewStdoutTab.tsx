import React, { useEffect, useState } from 'react';
import { useDesignSystemTheme, Typography, Empty, DangerIcon } from '@databricks/design-system';
import { FormattedMessage } from 'react-intl';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { coy as style, atomDark as darkStyle } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { ArtifactViewSkeleton } from '../artifact-view-components/ArtifactViewSkeleton';
import { fetchArtifactUnified } from '../artifact-view-components/utils/fetchArtifactUnified';
import { getArtifactContent } from '../../../common/utils/ArtifactUtils';
import type { KeyValueEntity } from '../../types';

/**
 * A run page tab containing the stdout log viewer
 */
export const RunViewStdoutTab = ({
  runUuid,
  experimentId,
  runTags,
}: {
  runUuid: string;
  experimentId: string;
  runTags: Record<string, KeyValueEntity>;
}) => {
  const { theme } = useDesignSystemTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [stdoutContent, setStdoutContent] = useState<string>('');

  useEffect(() => {
    const fetchStdoutContent = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const content = await fetchArtifactUnified(
          {
            runUuid,
            path: 'stdout.log',
            experimentId,
            isLoggedModelsMode: false,
          },
          getArtifactContent
        );
        
        setStdoutContent(content as string);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchStdoutContent();
  }, [runUuid, experimentId]);

  if (loading) {
    return (
      <div css={{ flex: 1, padding: theme.spacing.md }}>
        <ArtifactViewSkeleton className="stdout-loading" />
      </div>
    );
  }

  if (error) {
    return (
      <div css={{ flex: 1, padding: theme.spacing.md }}>
        <Empty
          image={<DangerIcon />}
          title={
            <FormattedMessage
              defaultMessage="No stdout logs found"
              description="Run page > stdout tab > no stdout logs title"
            />
          }
          description={
            <FormattedMessage
              defaultMessage="This run does not have stdout logging enabled or no stdout.log artifact was found. To enable stdout logging, set log_stdout=True when calling mlflow.start_run()."
              description="Run page > stdout tab > no stdout logs description"
            />
          }
        />
      </div>
    );
  }

  if (!stdoutContent.trim()) {
    return (
      <div css={{ flex: 1, padding: theme.spacing.md }}>
        <Empty
          title={
            <FormattedMessage
              defaultMessage="No stdout output"
              description="Run page > stdout tab > empty stdout title"
            />
          }
          description={
            <FormattedMessage
              defaultMessage="The stdout.log file exists but contains no content."
              description="Run page > stdout tab > empty stdout description"
            />
          }
        />
      </div>
    );
  }

  const syntaxStyle = theme.isDarkMode ? darkStyle : style;

  return (
    <div
      css={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        padding: theme.spacing.md,
      }}
    >
      <div css={{ marginBottom: theme.spacing.sm }}>
        <Typography.Title level={3}>
          <FormattedMessage
            defaultMessage="Standard Output"
            description="Run page > stdout tab > title"
          />
        </Typography.Title>
        <Typography.Text color="secondary">
          <FormattedMessage
            defaultMessage="Real-time stdout logs captured during run execution"
            description="Run page > stdout tab > subtitle"
          />
        </Typography.Text>
      </div>
      
      <div
        css={{
          flex: 1,
          overflow: 'auto',
          border: `1px solid ${theme.colors.borderDecorative}`,
          borderRadius: theme.borders.borderRadiusMd,
        }}
      >
        <SyntaxHighlighter
          language="text"
          style={syntaxStyle}
          customStyle={{
            fontFamily: 'Source Code Pro, Menlo, Monaco, monospace',
            fontSize: theme.typography.fontSizeSm,
            margin: 0,
            padding: theme.spacing.md,
            backgroundColor: theme.colors.backgroundSecondary,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            height: '100%',
            overflow: 'auto',
          }}
          showLineNumbers
          wrapLongLines
        >
          {stdoutContent}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}; 