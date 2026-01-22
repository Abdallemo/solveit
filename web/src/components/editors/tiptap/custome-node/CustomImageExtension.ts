import { EditorUploadedFileType } from "@/features/media/media-types";
import { Node } from "@tiptap/pm/model"; // Added for correct typing
import { Plugin } from "@tiptap/pm/state";
import { ResizableImage } from "tiptap-extension-resizable-image";

type UploadFunction = (file: File) => Promise<EditorUploadedFileType>;
type CleanupFunction = (resourceId: string) => Promise<void>;

export const CustomImageExtension = (
  uploadMedia: UploadFunction,
  cleanupMedia: CleanupFunction,
) =>
  ResizableImage.extend({
    addAttributes() {
      return {
        src: { default: null },
        alt: { default: null },
        title: { default: null },
        width: { default: "100%" }, // Required for ResizableImage
        height: { default: "auto" }, // Required for ResizableImage,
        "data-temp-id": {
          default: null,
        },
        "data-id": { default: null },
      };
    },

    // addOptions() {
    //   const parentDefuat = this.parent?.() || {};
    //   parentDefuat.defaultHeight = 200;
    //   parentDefuat.defaultWidth = 200;
    //   return parentDefuat;
    // },
    addCommands() {
      const parentCommands = this.parent?.() || {};

      return {
        setImage:
          (options: { src: string | File; alt?: string; title?: string }) =>
          ({ chain, editor }) => {
            const file = options.src instanceof File ? options.src : undefined;

            if (file) {
              const tempId = `uploading-${Date.now()}`;
              const localUrl = URL.createObjectURL(file);

              chain()
                .focus()
                .insertContent(
                  `<img src="${localUrl}" data-temp-id="${tempId}" alt="Uploading image..." />`,
                )
                .run();

              uploadMedia(file)
                .then(({ filePath, fileName, url }) => {
                  const publicUrl = url;
                  console.log(filePath);
                  editor.state.doc.descendants((node, pos) => {
                    if (
                      node.type.name === "image" &&
                      node.attrs["data-temp-id"] === tempId
                    ) {
                      editor.view.dispatch(
                        editor.state.tr.setNodeMarkup(pos, undefined, {
                          ...node.attrs,
                          src: publicUrl,
                          "data-temp-id": null,
                          "data-id": filePath,
                          "data-keep-ratio": true,
                          alt: fileName || "",
                        }),
                      );
                      return false;
                    }
                    return true;
                  });
                })
                .catch((error) => {
                  console.error("Upload failed, removing placeholder:", error);

                  editor.commands.command(({ tr, state }) => {
                    state.doc.descendants((node, pos) => {
                      if (
                        node.type.name === "image" &&
                        node.attrs["data-temp-id"] === tempId
                      ) {
                        tr.delete(pos, pos + node.nodeSize);
                        return false;
                      }
                      return true;
                    });
                    return true;
                  });
                });

              return true;
            }

            const originalSetImage = parentCommands.setImage as any;

            if (originalSetImage) {
              return originalSetImage(options)({ chain, editor });
            }

            return false;
          },
      };
    },

    addProseMirrorPlugins() {
      const extension = this;
      const ImageNodeType = extension.editor.schema.nodes["image"];

      return [
        new Plugin({
          appendTransaction: (transactions, oldState, newState) => {
            if (!transactions.some((t) => t.docChanged) || !cleanupMedia) {
              return null;
            }

            const oldImageIds = new Set<string>();
            oldState.doc.descendants((node: Node) => {
              if (node.type === ImageNodeType) {
                const resourceId = node.attrs["data-id"];
                if (resourceId) {
                  oldImageIds.add(resourceId);
                }
              }
            });

            const newImageIds = new Set<string>();
            newState.doc.descendants((node: Node) => {
              if (node.type === ImageNodeType) {
                const resourceId = node.attrs["data-id"];
                if (resourceId) {
                  newImageIds.add(resourceId);
                }
              }
            });

            oldImageIds.forEach((resourceId) => {
              if (!newImageIds.has(resourceId)) {
                cleanupMedia(resourceId).catch((error) =>
                  console.error(
                    `Cleanup failed for ID: ${resourceId} (True Deletion)`,
                    error,
                  ),
                );
              }
            });

            return null;
          },
        }),
      ];
    },
  });
