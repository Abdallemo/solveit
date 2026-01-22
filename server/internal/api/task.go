package api

import (
	"fmt"
	"github/abdallemo/solveit-saas/internal/middleware"
	"log"
	"net/http"
)

// DraftTask Resource
func (s *Server) handleCreateDraftTaskFiles(w http.ResponseWriter, r *http.Request) {
	reader, err := r.MultipartReader()
	if err != nil {
		sendHTTPError(w, "Unable to process upload stream", http.StatusBadRequest)
		return
	}

	userId, _ := middleware.GetUserID(r.Context())
	result, _ := s.TaskService.CreateDraftTaskFiles(r.Context(), userId, reader)

	WriteJSON(w, result, 200)
}

// DraftTask Resource
func (s *Server) handleDeleteDraftTaskFile(w http.ResponseWriter, r *http.Request) {
	userId, _ := middleware.GetUserID(r.Context())

	filePath := r.PathValue("filePath")
	if filePath == "" {
		http.Error(w, "file path is required", http.StatusBadRequest)
	}

	err := s.TaskService.DeleteDraftTaskFile(r.Context(), userId, filePath)
	if err != nil {
		log.Printf("Error Deleting from S3: %s", err.Error())
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}

	w.WriteHeader(http.StatusOK)
	fmt.Fprint(w, "Item successfully deleted based on key: "+filePath)
}
