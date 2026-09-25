'use client';

import { Suspense } from 'react';
import { EntityForm } from '@/components/create/EntityForm';
import { documentFormConfig } from '@/config/entity-configs/document-form-config';
import { FileText } from 'lucide-react';
import Loading from '@/components/Loading';
import { ROUTES } from '@/config/routes';
import { useDocumentCreate } from './useDocumentCreate';
import { DocumentChooseMode } from './DocumentChooseMode';
import { DocumentUploadMode } from './DocumentUploadMode';

function DocumentPageContent() {
  const {
    user,
    authLoading,
    router,
    editId,
    mode,
    setMode,
    initialValues,
    isLoadingDocument,
    loadError,
    uploadedFileName,
    handleContentExtracted,
    handleUploadError,
    enterFormMode,
  } = useDocumentCreate();

  if (authLoading || isLoadingDocument) {
    return <Loading fullScreen message={editId ? 'Loading document...' : 'Loading...'} />;
  }

  if (!user) {
    return null;
  }

  if (loadError) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="oc-error-surface p-6 text-center">
          <h2 className="text-lg font-semibold mb-2">Error</h2>
          <p className="mb-4 text-status-negative/80">{loadError}</p>
          <button
            onClick={() => router.push(`${ROUTES.DASHBOARD.CAT_SETTINGS}#knows`)}
            className="text-sm text-status-negative underline hover:text-status-negative/80"
          >
            Back to My Context
          </button>
        </div>
      </div>
    );
  }

  if (editId && initialValues) {
    return (
      <div className="container max-w-4xl py-8">
        <EntityForm
          config={documentFormConfig}
          initialValues={initialValues}
          mode="edit"
          entityId={editId}
        />
      </div>
    );
  }

  if (mode === 'choose') {
    return <DocumentChooseMode onUpload={() => setMode('upload')} onWrite={enterFormMode} />;
  }

  if (mode === 'upload') {
    return (
      <DocumentUploadMode
        onBack={() => setMode('choose')}
        onWrite={enterFormMode}
        onContentExtracted={handleContentExtracted}
        onError={handleUploadError}
      />
    );
  }

  return (
    <div className="container max-w-4xl py-8">
      {uploadedFileName && (
        <div className="mb-4 px-4 py-3 bg-status-positive-subtle border border-subtle rounded-lg flex items-center gap-2">
          <FileText className="h-4 w-4 text-status-positive" />
          <span className="text-sm text-status-positive">
            Content extracted from <strong>{uploadedFileName}</strong>. Review and save below.
          </span>
        </div>
      )}
      <EntityForm config={documentFormConfig} initialValues={initialValues} mode="create" />
    </div>
  );
}

export default function CreateDocumentPage() {
  return (
    <Suspense fallback={<Loading fullScreen message="Loading..." />}>
      <DocumentPageContent />
    </Suspense>
  );
}
