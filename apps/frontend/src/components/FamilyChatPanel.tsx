import { useEffect, useMemo, useRef, useState } from 'react';
import { Mic, Paperclip, Send, Square, WandSparkles } from 'lucide-react';
import { useSelector } from 'react-redux';
import {
  backendMode,
  getChatMessages,
  getChatImageUrls,
  getSubstituteSuggestions,
  learnSubstitute,
  sendChatMessage,
  type ApiError,
} from '../lib/api';
import { supabase } from '../lib/supabase';
import type { RootState } from '../store';
import type { ChatMessage, InventoryItem, ProductSubstituteSuggestion } from '../types/domain';
import { ToastStack, type ToastItem } from './ToastStack';
import { useLanguage } from '../lib/i18n';

interface FamilyChatPanelProps {
  listItems: InventoryItem[];
}

type LocalMessage = Omit<ChatMessage, 'id' | 'family_id' | 'sender_user_id' | 'created_at'> & {
  id: string;
  family_id: string;
  sender_user_id: string;
  created_at: string;
};

function readLocalMessages(familyId: string): ChatMessage[] {
  const raw = localStorage.getItem(`familyChat:${familyId}`);
  if (!raw) return [];

  try {
    return JSON.parse(raw) as ChatMessage[];
  } catch {
    return [];
  }
}

function writeLocalMessages(familyId: string, messages: ChatMessage[]) {
  localStorage.setItem(`familyChat:${familyId}`, JSON.stringify(messages));
}

function readLocalSuggestions(familyId: string, productName: string): ProductSubstituteSuggestion[] {
  const raw = localStorage.getItem(`substitutes:${familyId}`);
  if (!raw) return [];

  try {
    const all = JSON.parse(raw) as ProductSubstituteSuggestion[];
    return all
      .filter((entry) => entry.original_product_name === productName.trim().toLowerCase())
      .sort((a, b) => b.learned_count - a.learned_count)
      .slice(0, 5);
  } catch {
    return [];
  }
}

function upsertLocalSuggestion(familyId: string, original: string, substitute: string) {
  const key = `substitutes:${familyId}`;
  const raw = localStorage.getItem(key);
  const all = raw ? ((JSON.parse(raw) as ProductSubstituteSuggestion[]) ?? []) : [];
  const normalizedOriginal = original.trim().toLowerCase();
  const normalizedSubstitute = substitute.trim().toLowerCase();

  const index = all.findIndex(
    (entry) =>
      entry.original_product_name === normalizedOriginal && entry.substitute_product_name === normalizedSubstitute,
  );

  if (index >= 0) {
    all[index] = {
      ...all[index],
      learned_count: all[index].learned_count + 1,
      last_used_at: new Date().toISOString(),
    };
  } else {
    all.unshift({
      id: crypto.randomUUID(),
      family_id: familyId,
      original_product_name: normalizedOriginal,
      substitute_product_name: normalizedSubstitute,
      confidence: 0.8,
      learned_count: 1,
      last_used_at: new Date().toISOString(),
    });
  }

  localStorage.setItem(key, JSON.stringify(all));
}

function apiErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Unexpected error';
}

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '-');
}

function extFromMime(mimeType: string): string {
  if (mimeType.includes('png')) return 'png';
  if (mimeType.includes('webp')) return 'webp';
  return 'jpg';
}

async function compressImageFile(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file;

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to decode image file'));
    img.src = dataUrl;
  });

  const maxDimension = 1280;
  const ratio = Math.min(1, maxDimension / Math.max(image.width, image.height));
  const targetWidth = Math.max(1, Math.round(image.width * ratio));
  const targetHeight = Math.max(1, Math.round(image.height * ratio));

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const context = canvas.getContext('2d');
  if (!context) return file;
  context.drawImage(image, 0, 0, targetWidth, targetHeight);

  const outputType = file.type.includes('png') ? 'image/png' : 'image/jpeg';
  const quality = outputType === 'image/jpeg' ? 0.82 : undefined;

  return new Promise<File>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to compress image'));
          return;
        }

        const ext = extFromMime(outputType);
        const baseName = sanitizeFileName(file.name).replace(/\.[a-zA-Z0-9]+$/, '') || 'chat-image';
        resolve(new File([blob], `${baseName}.${ext}`, { type: outputType }));
      },
      outputType,
      quality,
    );
  });
}

export function FamilyChatPanel({ listItems }: FamilyChatPanelProps) {
  const { t } = useLanguage();
  const user = useSelector((state: RootState) => state.auth.user);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [resolvedImageUrls, setResolvedImageUrls] = useState<Record<string, string>>({});
  const [body, setBody] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const [missingProduct, setMissingProduct] = useState('');
  const [replacementProduct, setReplacementProduct] = useState('');
  const [suggestions, setSuggestions] = useState<ProductSubstituteSuggestion[]>([]);

  const extractChatImagePath = (imageUrl?: string) => {
    if (!imageUrl) return null;

    const customPrefix = 'storage:chat-images/';
    if (imageUrl.startsWith(customPrefix)) {
      return imageUrl.slice(customPrefix.length);
    }

    const signedPrefix = '/storage/v1/object/sign/chat-images/';
    const signedIndex = imageUrl.indexOf(signedPrefix);
    if (signedIndex >= 0) {
      const rawPath = imageUrl.slice(signedIndex + signedPrefix.length).split('?')[0] || '';
      return decodeURIComponent(rawPath);
    }

    const publicPrefix = '/storage/v1/object/public/chat-images/';
    const publicIndex = imageUrl.indexOf(publicPrefix);
    if (publicIndex >= 0) {
      const rawPath = imageUrl.slice(publicIndex + publicPrefix.length).split('?')[0] || '';
      return decodeURIComponent(rawPath);
    }

    return null;
  };

  const resolveSignedUrls = async (targetMessages: ChatMessage[]) => {
    const allPaths = targetMessages.flatMap((message) => {
      const directPath = message.image_path || extractChatImagePath(message.image_url) || undefined;
      const attachmentPaths = (message.attachments ?? []).map((attachment) => attachment.storage_path);
      return [directPath, ...attachmentPaths].filter((path): path is string => Boolean(path));
    });

    const uniquePaths = Array.from(new Set(allPaths));
    if (!uniquePaths.length) return;

    const response = await getChatImageUrls(uniquePaths, 60 * 60 * 6);
    if (Object.keys(response.urlsByPath).length) {
      setResolvedImageUrls((current) => ({ ...current, ...response.urlsByPath }));
    }
  };

  const pushToast = (message: string, tone: ToastItem['tone'] = 'info') => {
    const id = crypto.randomUUID();
    setToasts((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 3200);
  };

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      setLoading(true);
      setErrorText(null);

      try {
        if (backendMode) {
          const data = await getChatMessages(100);
          setMessages(data.messages);
        } else {
          setMessages(readLocalMessages(user.familyId));
        }
      } catch (error) {
        setErrorText(apiErrorMessage(error));
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [user]);

  useEffect(() => {
    if (!messages.length || !backendMode) return;

    void resolveSignedUrls(messages);

    const refreshId = window.setInterval(() => {
      void resolveSignedUrls(messages);
    }, 1000 * 60 * 45);

    return () => {
      window.clearInterval(refreshId);
    };
  }, [messages]);

  useEffect(() => {
    if (!user || !supabase) return;

    const client = supabase;

    const channel = client
      .channel(`chat-live-${user.familyId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `family_id=eq.${user.familyId}` },
        async (payload) => {
          const incoming = payload.new as ChatMessage;
          if (backendMode) {
            try {
              const data = await getChatMessages(100);
              setMessages(data.messages);
            } catch {
              setMessages((prev) => (prev.some((message) => message.id === incoming.id) ? prev : [...prev, incoming]));
            }
            return;
          }

          setMessages((prev) => (prev.some((message) => message.id === incoming.id) ? prev : [...prev, incoming]));
        },
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [user]);

  useEffect(() => {
    return () => {
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== 'inactive') {
        recorder.stop();
      }

      const stream = mediaStreamRef.current;
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const productOptions = useMemo(() => {
    const names = Array.from(new Set(listItems.map((item) => item.product_name.trim()).filter(Boolean)));
    return names.sort((a, b) => a.localeCompare(b));
  }, [listItems]);

  if (!user) return null;

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      return;
    }

    recorder.stop();
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setErrorText(t('chat.error.recordingUnsupported'));
      pushToast(t('chat.toast.recordingFailed'), 'error');
      return;
    }

    if (isRecording) {
      stopRecording();
      return;
    }

    try {
      setErrorText(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const supportedType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find((mimeType) =>
        MediaRecorder.isTypeSupported(mimeType),
      );
      const recorder = supportedType ? new MediaRecorder(stream, { mimeType: supportedType }) : new MediaRecorder(stream);

      audioChunksRef.current = [];
      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        setErrorText(t('chat.toast.recordingFailed'));
        setIsRecording(false);
      };

      recorder.onstop = () => {
        const streamRef = mediaStreamRef.current;
        if (streamRef) {
          streamRef.getTracks().forEach((track) => track.stop());
        }

        mediaStreamRef.current = null;
        mediaRecorderRef.current = null;
        setIsRecording(false);

        if (!audioChunksRef.current.length) return;

        const mimeType = recorder.mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        const extension = mimeType.includes('mp4') ? 'm4a' : mimeType.includes('ogg') ? 'ogg' : 'webm';
        const voiceFile = new File([blob], `voice-note-${Date.now()}.${extension}`, { type: mimeType });
        setSelectedFiles((current) => [...current, voiceFile]);
        audioChunksRef.current = [];
        pushToast(t('chat.toast.recorded'), 'success');
      };

      recorder.start(250);
      setIsRecording(true);
    } catch {
      setErrorText(t('chat.toast.recordingFailed'));
      pushToast(t('chat.toast.recordingFailed'), 'error');
      setIsRecording(false);
    }
  };

  const sendMessage = async () => {
    if (!body.trim() && selectedFiles.length === 0) return;

    setSending(true);
    setErrorText(null);

    try {
      let imageUrl: string | undefined;
      let imagePath: string | undefined;
      let attachments: Array<{ storagePath: string; fileName?: string; mimeType?: string; fileSize?: number }> = [];

      if (selectedFiles.length > 0) {
        if (!supabase) {
          throw new Error(t('chat.error.storageRequired'));
        }

        const uploaded: Array<{ storagePath: string; fileName?: string; mimeType?: string; fileSize?: number }> = [];
        for (const file of selectedFiles) {
          const processed = await compressImageFile(file);
          const path = `${user.familyId}/${user.id}/${Date.now()}-${sanitizeFileName(processed.name)}`;

          const upload = await supabase.storage.from('chat-images').upload(path, processed, {
            upsert: false,
            cacheControl: '3600',
            contentType: processed.type || undefined,
          });

          if (upload.error) throw new Error(upload.error.message);
          uploaded.push({
            storagePath: path,
            fileName: processed.name,
            mimeType: processed.type || undefined,
            fileSize: processed.size,
          });
        }

        attachments = uploaded;
        const first = uploaded[0];
        if (first) {
          imagePath = first.storagePath;
          imageUrl = `storage:chat-images/${first.storagePath}`;
        }
      }

      if (backendMode) {
        const created = await sendChatMessage({
          body: body.trim() || t('chat.attachmentMessageFallback'),
          imagePath,
          imageUrl,
          attachments,
        });
        setMessages((prev) => [...prev, created]);
      } else {
        const localMessage: LocalMessage = {
          id: crypto.randomUUID(),
          family_id: user.familyId,
          sender_user_id: user.id,
          sender_name: user.email,
          body: body.trim() || t('chat.attachmentMessageFallback'),
          image_path: imagePath,
          image_url: imageUrl,
          kind: 'message',
          created_at: new Date().toISOString(),
          attachments: attachments.map((entry) => ({
            id: crypto.randomUUID(),
            message_id: '',
            family_id: user.familyId,
            storage_path: entry.storagePath,
            file_name: entry.fileName,
            mime_type: entry.mimeType,
            file_size: entry.fileSize,
            created_at: new Date().toISOString(),
          })),
        };
        localMessage.attachments = (localMessage.attachments ?? []).map((attachment) => ({
          ...attachment,
          message_id: localMessage.id,
        }));
        const next = [...messages, localMessage];
        setMessages(next);
        writeLocalMessages(user.familyId, next);
      }

      setBody('');
      setSelectedFiles([]);
      pushToast(t('chat.toast.messageSent'), 'success');
    } catch (error) {
      setErrorText(apiErrorMessage(error));
      pushToast(t('chat.toast.sendFailed'), 'error');
    } finally {
      setSending(false);
    }
  };

  const loadSuggestions = async () => {
    if (!missingProduct.trim()) {
      setSuggestions([]);
      return;
    }

    try {
      if (backendMode) {
        const result = await getSubstituteSuggestions(missingProduct);
        setSuggestions(result.suggestions);
      } else {
        setSuggestions(readLocalSuggestions(user.familyId, missingProduct));
      }
    } catch (error) {
      setErrorText(apiErrorMessage(error));
    }
  };

  const saveSubstituteDecision = async () => {
    if (!missingProduct.trim() || !replacementProduct.trim()) return;

    setSending(true);
    setErrorText(null);

    try {
      if (backendMode) {
        const message = await sendChatMessage({
          body: `Substitute chosen: ${replacementProduct.trim()} instead of ${missingProduct.trim()}`,
          kind: 'decision',
          relatedProductName: replacementProduct.trim(),
          substituteFor: missingProduct.trim(),
        });

        await learnSubstitute({
          originalProductName: missingProduct.trim(),
          substituteProductName: replacementProduct.trim(),
          sourceMessageId: message.id,
        });

        setMessages((prev) => [...prev, message]);
      } else {
        upsertLocalSuggestion(user.familyId, missingProduct, replacementProduct);
        const localMessage: LocalMessage = {
          id: crypto.randomUUID(),
          family_id: user.familyId,
          sender_user_id: user.id,
          sender_name: user.email,
          body: `Substitute chosen: ${replacementProduct.trim()} instead of ${missingProduct.trim()}`,
          kind: 'decision',
          created_at: new Date().toISOString(),
        };
        const next = [...messages, localMessage];
        setMessages(next);
        writeLocalMessages(user.familyId, next);
      }

      await loadSuggestions();
      setReplacementProduct('');
      pushToast(t('chat.toast.substituteSaved'), 'success');
    } catch (error) {
      const status = (error as ApiError | undefined)?.status;
      if (status === 402) {
        setErrorText(t('chat.error.premiumRequired'));
      } else {
        setErrorText(apiErrorMessage(error));
      }
      pushToast(t('chat.toast.substituteFailed'), 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200/90 bg-white/95 p-4 shadow-sm backdrop-blur">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-900">{t('chat.title')}</h3>
        <span className="text-xs text-slate-500">{t('chat.subtitle')}</span>
      </div>

      <div className="mb-3 max-h-72 space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
        {loading && <p className="text-sm text-slate-500">{t('chat.loading')}</p>}
        {!loading && !messages.length && <p className="text-sm text-slate-500">{t('chat.noMessages')}</p>}

        {messages.map((message) => (
          <article key={message.id} className="rounded-lg border border-slate-200 bg-white p-2 text-sm">
            <p className="font-medium text-slate-800">{message.sender_name || t('chat.familyMember')}</p>
            <p className="mt-1 text-slate-700">{message.body}</p>
            {(message.attachments ?? []).map((attachment) => {
              const signedUrl = resolvedImageUrls[attachment.storage_path];
              if (!signedUrl) return null;

              const mimeType = attachment.mime_type || '';
              const isImage = mimeType.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(attachment.file_name || '');

              if (isImage) {
                return (
                  <img
                    key={attachment.id}
                    className="mt-2 max-h-36 rounded-md border border-slate-200 object-contain"
                    src={signedUrl}
                    alt={attachment.file_name || t('chat.sharedAttachment')}
                  />
                );
              }

              const isAudio = mimeType.startsWith('audio/') || /\.(mp3|wav|m4a|ogg|webm)$/i.test(attachment.file_name || '');
              if (isAudio) {
                return <audio key={attachment.id} className="mt-2 w-full" src={signedUrl} controls preload="metadata" />;
              }

              return (
                <a
                  key={attachment.id}
                  className="mt-2 inline-block text-xs font-medium text-indigo-700 underline"
                  href={signedUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {attachment.file_name || t('chat.openAttachment')}
                </a>
              );
            })}
            {!message.attachments?.length && message.image_url && (
              <img
                className="mt-2 max-h-36 rounded-md border border-slate-200 object-contain"
                src={resolvedImageUrls[message.image_path || extractChatImagePath(message.image_url) || ''] || message.image_url}
                alt={t('chat.sharedProduct')}
              />
            )}
            <p className="mt-1 text-xs text-slate-400">{new Date(message.created_at).toLocaleString()}</p>
          </article>
        ))}
      </div>

      <div className="space-y-2 rounded-xl border border-indigo-100 bg-indigo-50/50 p-3">
        <p className="flex items-center gap-1 text-sm font-medium text-indigo-900">
          <WandSparkles size={14} />
          {t('chat.substituteLearning')}
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <select
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            value={missingProduct}
            onChange={(event) => setMissingProduct(event.target.value)}
          >
            <option value="">{t('chat.missingProduct')}</option>
            {productOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <input
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            placeholder={t('chat.chosenSubstitute')}
            value={replacementProduct}
            onChange={(event) => setReplacementProduct(event.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
            onClick={() => void loadSuggestions()}
          >
            {t('chat.showSuggestions')}
          </button>
          <button
            type="button"
            className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            onClick={() => void saveSubstituteDecision()}
            disabled={sending}
          >
            {t('chat.saveSubstitute')}
          </button>
        </div>
        {suggestions.length > 0 && (
          <ul className="space-y-1 text-xs text-slate-600">
            {suggestions.map((entry) => (
              <li key={entry.id}>
                {t('chat.suggestionPrefix')} <strong>{entry.substitute_product_name}</strong>{' '}
                {t('chat.suggestionUsed', { count: entry.learned_count })}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
        <input
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          placeholder={t('chat.messagePlaceholder')}
          value={body}
          onChange={(event) => setBody(event.target.value)}
        />
        <label className="inline-flex cursor-pointer items-center justify-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100">
          <Paperclip size={14} />
          {t('chat.attach')}
          <input
            type="file"
            multiple
            className="hidden"
            onChange={(event) => setSelectedFiles(Array.from(event.target.files ?? []))}
          />
        </label>
        <button
          type="button"
          className={`inline-flex items-center justify-center gap-1 rounded-lg px-3 py-2 text-xs font-medium text-white transition ${
            isRecording ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'
          }`}
          onClick={() => void startRecording()}
        >
          {isRecording ? <Square size={14} /> : <Mic size={14} />}
          {isRecording ? t('chat.stopRecording') : t('chat.record')}
        </button>
        <button
          type="button"
          className="inline-flex items-center justify-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          onClick={() => void sendMessage()}
          disabled={sending || (!body.trim() && selectedFiles.length === 0)}
        >
          <Send size={14} />
          {t('chat.send')}
        </button>
      </div>

      {selectedFiles.length > 0 && (
        <p className="mt-1 text-xs text-slate-500">
          {t('chat.selectedAttachments', { count: selectedFiles.length })}: {selectedFiles.map((file) => file.name).join(', ')}
        </p>
      )}
      {!backendMode && <p className="mt-2 text-xs text-amber-700">{t('chat.localMode')}</p>}
      {errorText && <p className="mt-2 text-xs text-rose-700">{errorText}</p>}
      <div className="mt-2">
        <ToastStack toasts={toasts} />
      </div>
    </section>
  );
}
