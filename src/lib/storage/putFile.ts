// Browser upload to a signed upload URL. Same request as supabase-js uploadToSignedUrl (PUT,
// form data, file under the empty field name, no upsert), but over XHR: fetch reports no
// upload progress.

const CACHE_CONTROL = '3600';

function failure(status: number, body: string): Error {
  try {
    const { message } = JSON.parse(body) as { message?: unknown };
    if (typeof message === 'string' && message) return new Error(message);
  } catch {
    // Not JSON (proxy or gateway page): fall back to the status below.
  }
  return new Error(`Upload failed (${status}).`);
}

/** Resolves when storage has the file. `onProgress` gets whole percentages (0-100). */
export function putFile(uploadUrl: string, file: File, onProgress: (percent: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(failure(xhr.status, xhr.responseText)));
    xhr.onerror = () => reject(new Error('Upload failed. Check your connection and try again.'));
    const body = new FormData();
    body.append('cacheControl', CACHE_CONTROL);
    body.append('', file);
    xhr.send(body);
  });
}
