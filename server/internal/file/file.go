package file

import (
	"context"
	"fmt"
	"io"
	"os"
	"sync"
	"time"

	"mime/multipart"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/google/uuid"
)

const (
	MaxFileSize = 50 << 20
)

func BytesToMB(bytes int) int {
	return bytes >> 20
}

func MBToBytes(mb int) int {
	return mb << 20
}

type Service struct {
	s3Client *s3.Client
}

func NewService(s3Client *s3.Client) *Service {
	return &Service{
		s3Client: s3Client,
	}
}

type FailedFileError struct {
	File  FileMeta `json:"file"`
	Error string   `json:"error"`
}
type UploadFileRes struct {
	FailedFiles   []FailedFileError `json:"failedFiles"`
	UploadedFiles []FileMeta        `json:"uploadedFiles"`
}

type FileMeta struct {
	FileName string  `json:"fileName"`
	FileType string  `json:"fileType"`
	FileSize float64 `json:"fileSize"`
	FilePath string  `json:"filePath"`
}
type DownloadedFile struct {
	Body          io.ReadCloser
	ContentType   string
	ContentLength int64
}

type FileBatch struct {
	Names []string
	Types []string
	Paths []string
	Sizes []int32
}

// Helper
func BuildFileMeta(fh *multipart.FileHeader, key string) FileMeta {
	return FileMeta{
		FileName: fh.Filename,
		FileType: fh.Header.Get("Content-Type"),
		FileSize: float64(fh.Size),
		FilePath: key,
	}
}

// NewFileBatch transforms a slice of file metadata into column slices for bulk DB insertion
func NewFileBatch(files []FileMeta) FileBatch {

	n := len(files)
	batch := FileBatch{
		Names: make([]string, 0, n),
		Types: make([]string, 0, n),
		Paths: make([]string, 0, n),
		Sizes: make([]int32, 0, n),
	}

	for _, f := range files {
		batch.Names = append(batch.Names, f.FileName)
		batch.Types = append(batch.Types, f.FileType)
		batch.Paths = append(batch.Paths, f.FilePath)
		batch.Sizes = append(batch.Sizes, int32(f.FileSize))
	}

	return batch
}

func (s *Service) DeleteFromS3(filePth string) error {
	_, err := s.s3Client.DeleteObject(context.TODO(), &s3.DeleteObjectInput{
		Bucket: aws.String("solveit"),
		Key:    aws.String(filePth),
	})

	if err != nil {
		//http.Error(w, "Error Deleting from S3: "+err.Error(), http.StatusBadRequest)
		return err
	}
	return nil
}

// GetFile
func (s *Service) GetFile(ctx context.Context, key string) (*DownloadedFile, error) {

	obj, err := s.s3Client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String("solveit"),
		Key:    aws.String(key),
	})
	if err != nil {
		return nil, err
	}

	contentType := "application/octet-stream"
	if obj.ContentType != nil {
		contentType = *obj.ContentType
	}

	var contentLength int64
	if obj.ContentLength != nil {
		contentLength = *obj.ContentLength
	}

	return &DownloadedFile{
		Body:          obj.Body,
		ContentType:   contentType,
		ContentLength: contentLength,
	}, nil
}

type UploadConfig struct {
	MaxFileSize int64
	Validator   func(part *multipart.Part) error
}

type uploadResult struct {
	Success *FileMeta
	Failure *FailedFileError
}

func (s *Service) ProcessBatchUpload(reader *multipart.Reader, scope string, id uuid.UUID, config UploadConfig) ([]FileMeta, []FailedFileError) {

	resultsChan := make(chan uploadResult, 50)
	var wg sync.WaitGroup

	uploaded := []FileMeta{}
	failed := []FailedFileError{}

	maxSize := config.MaxFileSize
	if maxSize == 0 {
		maxSize = MaxFileSize
	}

	for {
		part, err := reader.NextPart()
		if err == io.EOF {
			break
		}
		if err != nil {
			continue
		}
		if part.FormName() != "files" {
			continue
		}

		fileName := part.FileName()
		contentType := part.Header.Get("Content-Type")

		if config.Validator != nil {
			if err := config.Validator(part); err != nil {
				failed = append(failed, FailedFileError{
					File: FileMeta{
						FileName: fileName,
						FileType: contentType,
						FileSize: 0,
						FilePath: "",
					},
					Error: err.Error(),
				})
				io.Copy(io.Discard, part)
				continue
			}
		}

		tempFile, err := os.CreateTemp("", "upload-stream-*")
		if err != nil {
			failed = append(failed, FailedFileError{
				File: FileMeta{
					FileName: fileName,
					FileType: contentType,
					FileSize: 0,
				},
				Error: "Server error",
			})
			continue
		}

		limitedReader := io.LimitReader(part, maxSize+1) // 1 byte as extra buffer
		written, err := io.Copy(tempFile, limitedReader)

		if written > maxSize {
			failed = append(failed, FailedFileError{
				File: FileMeta{
					FileName: fileName,
					FileType: contentType,
					FileSize: float64(written),
				},
				Error: fmt.Sprintf("Exceeded server limit (%dMB)", BytesToMB(int(maxSize))),
			})

			io.Copy(io.Discard, part)
			tempFile.Close()
			os.Remove(tempFile.Name())
			continue
		}

		wg.Add(1)

		go s.uploadWorker(&wg, resultsChan, tempFile, fileName, contentType, scope, id, written)
	}

	go func() {
		wg.Wait()
		close(resultsChan)
	}()

	for res := range resultsChan {
		if res.Failure != nil {
			failed = append(failed, *res.Failure)
		} else if res.Success != nil {
			uploaded = append(uploaded, *res.Success)
		}
	}

	return uploaded, failed
}

func (s *Service) uploadWorker(
	wg *sync.WaitGroup,
	resultsChan chan<- uploadResult,
	f *os.File,
	fName, fType, scope string,
	id uuid.UUID,
	size int64,
) {
	defer wg.Done()
	defer f.Close()
	defer os.Remove(f.Name())

	f.Seek(0, 0)

	key, err := s.UploadToS3(f, fName, fType, scope, id)

	if err != nil {
		resultsChan <- uploadResult{
			Failure: &FailedFileError{
				File: FileMeta{
					FileName: fName,
					FileType: fType,
					FileSize: float64(size),
					FilePath: "",
				},
				Error: fmt.Sprintf("upload error: %v", err),
			},
		}
		return
	}

	resultsChan <- uploadResult{
		Success: &FileMeta{
			FileName: fName,
			FileType: fType,
			FileSize: float64(size),
			FilePath: key,
		},
	}
}

func (s *Service) UploadToS3(
	fileStream io.Reader,
	fileName string,
	contentType string,
	scope string,
	id uuid.UUID,
) (key string, err error) {

	key = fmt.Sprintf("%s/%s-%s", scope, id.String(), fileName)

	_, err = s.s3Client.PutObject(context.TODO(), &s3.PutObjectInput{
		Bucket:      aws.String("solveit"),
		Key:         aws.String(key),
		Body:        fileStream,
		ContentType: aws.String(contentType),
	})

	if err != nil {
		return "", err
	}

	return key, nil
}

type PresignedResp struct {
	Url       string        `json:"url"`
	ValidTime time.Duration `json:"validTime"`
}

func (s *Service) GetPresignedURL(ctx context.Context, key string) (PresignedResp, error) {
	validTime := time.Minute * 5

	presignClient := s3.NewPresignClient(s.s3Client)

	request, err := presignClient.PresignGetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String("solveit"),
		Key:    aws.String(key),
	}, s3.WithPresignExpires(validTime))

	if err != nil {
		return PresignedResp{}, err
	}
	return PresignedResp{Url: request.URL, ValidTime: validTime}, nil
}
