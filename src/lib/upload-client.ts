export type UploadResult<T> = { status: number; body: T & { error?: string } };

// fetch() cannot report upload progress, so XMLHttpRequest is used here.
export function uploadWithProgress<T extends object = object>(
  url: string,
  file: File,
  onProgress: (percent: number) => void
): Promise<UploadResult<T>> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      let body = {} as UploadResult<T>["body"];
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        // Non-JSON response: keep the empty body.
      }
      resolve({ status: xhr.status, body });
    };
    xhr.onerror = () => reject(new Error("Network error"));

    const form = new FormData();
    form.append("file", file);
    xhr.send(form);
  });
}