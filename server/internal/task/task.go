package task

import (
	"context"
	"encoding/json"
	"errors"
	"github/abdallemo/solveit-saas/internal/database"
	"github/abdallemo/solveit-saas/internal/file"
	"log"
	"mime/multipart"

	"github.com/google/uuid"
)

type Service struct {
	store       *database.Queries
	fileService *file.Service
}

func NewTaskService(
	store *database.Queries,
	fileService *file.Service,

) *Service {
	return &Service{
		fileService: fileService,
		store:       store,
	}
}

func (s *Service) CreateDraftTaskFiles(ctx context.Context, userId uuid.UUID, reader *multipart.Reader) (file.UploadFileRes, error) {
	id := uuid.New()

	uploaded, failed := s.fileService.ProcessBatchUpload(reader, "task", id, file.UploadConfig{})
	upladedByte, _ := json.Marshal(uploaded)

	err := s.store.SaveDraftTaskFiles(ctx, database.SaveDraftTaskFilesParams{
		UserID:  userId,
		Column1: upladedByte,
	})
	if err != nil {
		return file.UploadFileRes{}, err

	}
	return file.UploadFileRes{
		UploadedFiles: uploaded, FailedFiles: failed,
	}, nil
}

func (s *Service) DeleteDraftTaskFile(ctx context.Context, userId uuid.UUID, filePath string) error {

	err := s.store.DeleteDraftTaskFile(ctx, database.DeleteDraftTaskFileParams{
		FilePath: filePath,
		UserID:   userId,
	})
	if err != nil {
		log.Printf("Error Deleting from S3: %s", err.Error())

		return errors.New("failed to delete")
	}

	err = s.fileService.DeleteFromS3(filePath)
	if err != nil {
		log.Printf("WARNING: DB deleted but S3 failed for %s. Error: %s", filePath, err.Error())
	}
	return nil
}
