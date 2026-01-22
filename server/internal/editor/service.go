package editor

import (
	"context"
	"errors"
	"github/abdallemo/solveit-saas/internal/database"
	"github/abdallemo/solveit-saas/internal/file"
	"log"
	"mime/multipart"
	"strings"

	"github.com/google/uuid"
)

type Service struct {
	store       *database.Queries
	fileService *file.Service
}

func NewService(
	store *database.Queries,
	fileService *file.Service,
) *Service {
	return &Service{
		store:       store,
		fileService: fileService,
	}
}

type editorFileResp struct {
	FileName string `json:"fileName"`
	FilePath string `json:"filePath"`
	Url      string `json:"url"`
}

func (s *Service) CreateEditorFiles(ctx context.Context, reader *multipart.Reader, scope string) (editorFileResp, error) {
	id := uuid.New()

	uploaded, failed := s.fileService.ProcessBatchUpload(reader, scope, id,
		file.UploadConfig{
			MaxFileSize: int64(file.MBToBytes(5)),
			Validator: func(part *multipart.Part) error {

				if !strings.HasPrefix(part.Header.Get("Content-Type"), "image/") {
					return errors.New("invalid file type: only images are allowed")
				}
				return nil
			}})

	if len(failed) > 0 {
		return editorFileResp{}, errors.New(failed[0].Error)
	}

	if len(uploaded) == 0 {
		return editorFileResp{}, errors.New("no files received")
	}

	editorFile, err := s.store.CreateEditorFile(ctx, database.CreateEditorFileParams{
		FileName: uploaded[0].FileName,
		FileType: uploaded[0].FilePath,
		FilePath: uploaded[0].FilePath,
		FileSize: int32(uploaded[0].FileSize),
	})

	if err != nil {
		return editorFileResp{}, errors.New("failed to upload")
	}

	presinged, err := s.fileService.GetPresignedURL(ctx, editorFile.FilePath)

	if err != nil {
		return editorFileResp{}, errors.New("failed to fetch")
	}

	return editorFileResp{FileName: editorFile.FileName, FilePath: editorFile.FilePath, Url: presinged.Url}, nil

}

// Editor Resource
func (s *Service) DeleteEditorFile(ctx context.Context, filePath string) error {

	err := s.store.DeleteEditorFile(ctx, filePath)
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
