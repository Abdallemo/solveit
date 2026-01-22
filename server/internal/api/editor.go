package api

import (
	"fmt"
	"net/http"
)

// Editor Resoucre
func (s *Server) handleCreateEditorFiles(w http.ResponseWriter, r *http.Request) {
	reader, err := r.MultipartReader()
	if err != nil {
		sendHTTPError(w, "Unable to process upload stream", http.StatusBadRequest)
		return
	}

	status := http.StatusOK
	UploadFileRes, err := s.EditorService.CreateEditorFiles(r.Context(), reader, "editor-images")
	if err != nil {
		status = http.StatusBadRequest
		WriteJSON(w, struct {
			Message string `json:"message"`
		}{Message: err.Error()}, status)
		return
	}

	WriteJSON(w, UploadFileRes, status)
}

// Editor Resource
func (s *Server) handleDeleteEditorFile(w http.ResponseWriter, r *http.Request) {

	filePath := r.PathValue("filePath")
	if filePath == "" {
		http.Error(w, "file path is required", http.StatusBadRequest)
	}
	err := s.EditorService.DeleteEditorFile(r.Context(), filePath)

	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}

	w.WriteHeader(http.StatusOK)
	fmt.Fprint(w, "Item successfully deleted based on key: "+filePath)
}
