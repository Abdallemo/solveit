package workspace

import (
	"context"
	"errors"
	"log"
	"mime/multipart"

	"github/abdallemo/solveit-saas/internal/database"
	"github/abdallemo/solveit-saas/internal/file"

	"github.com/google/uuid"
)

type Service struct {
	store       *database.Queries
	fileService *file.Service
}

func NewService(store *database.Queries, fs *file.Service) *Service {
	return &Service{store: store, fileService: fs}
}

func (s *Service) CreateFiles(ctx context.Context, workspaceID, userID uuid.UUID, reader *multipart.Reader) ([]file.FileMeta, []file.FailedFileError, error) {

	uploadID := uuid.New()
	uploaded, failed := s.fileService.ProcessBatchUpload(reader, "workspace", uploadID, file.UploadConfig{})

	if len(uploaded) > 0 {
		batch := file.NewFileBatch(uploaded)
		err := s.store.CreateWorkspaceFiles(ctx, database.CreateWorkspaceFilesParams{
			WorkspaceID:  workspaceID,
			UploadedByID: userID,
			FileName:     batch.Names,
			FileType:     batch.Types,
			FileSize:     batch.Sizes,
			FilePath:     batch.Paths,
		})
		if err != nil {
			return nil, nil, err
		}
	}

	return uploaded, failed, nil
}

func (s *Service) DeleteWorkspaceFiles(ctx context.Context, filePath string, workspaceId uuid.UUID) error {

	err := s.store.DeleteWorkspaceFile(ctx, database.DeleteWorkspaceFileParams{
		FilePath:    filePath,
		WorkspaceID: workspaceId,
	})

	if err != nil {
		log.Printf("Failed to delete %s. Error %s", filePath, err.Error())
		return errors.New("Failed to Delete")

	}

	return nil
}
