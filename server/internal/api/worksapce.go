package api

import (
	"fmt"
	"github/abdallemo/solveit-saas/internal/file"
	"github/abdallemo/solveit-saas/internal/middleware"
	"log"
	"net/http"

	"github.com/google/uuid"
)

func (s *Server) handleCreateWorkspaceFiles(w http.ResponseWriter, r *http.Request) {
	reader, err := r.MultipartReader()
	if err != nil {
		sendHTTPError(w, "Unable to process upload stream", http.StatusBadRequest)
		return
	}

	userID, _ := middleware.GetUserID(r.Context())
	workspaceID, err := uuid.Parse(r.PathValue("workspaceId"))

	if err != nil {
		sendHTTPError(w, "Invalid ID", http.StatusBadRequest)
		return
	}

	uploaded, failed, err := s.WorkspaceService.CreateFiles(r.Context(), workspaceID, userID, reader)

	if err != nil {
		log.Printf("Workspace upload error: %v", err)
		sendHTTPError(w, "Failed to save files", http.StatusInternalServerError)
		return
	}

	WriteJSON(w, file.UploadFileRes{UploadedFiles: uploaded, FailedFiles: failed}, 200)
}

func (s *Server) handleDeleteWorkspaceFiles(w http.ResponseWriter, r *http.Request) {

	filePath := r.PathValue("filePath")

	if filePath == "" {
		http.Error(w, "file path is required", http.StatusBadRequest)
	}

	workspaceID, err := uuid.Parse(r.PathValue("workspaceId"))

	if err != nil {
		sendHTTPError(w, "Invalid ID", http.StatusBadRequest)
		return
	}
	err = s.WorkspaceService.DeleteWorkspaceFiles(r.Context(), filePath, workspaceID)

	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}

	w.WriteHeader(http.StatusOK)
	fmt.Fprint(w, "Item successfully deleted based on key: "+filePath)
}
