import { useRef, useState } from 'react';
import { Upload, X, Link, ImageIcon, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Props {
  value: string;
  onChange: (url: string) => void;
  bucket?: string;
  folder?: string;
}

export default function ImageUpload({ value, onChange, bucket = 'product-images', folder = 'products' }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [dragging, setDragging] = useState(false);

  async function handleFile(file: File) {
    setError(null);
    if (!file.type.startsWith('image/')) {
      setError('Selecione um arquivo de imagem (JPG, PNG, WebP ou GIF).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('O arquivo deve ter no máximo 5 MB.');
      return;
    }
    setUploading(true);
    const ext = file.name.split('.').pop() ?? 'jpg';
    const path = `${folder}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, file, { upsert: false });
    if (uploadError) {
      setError('Erro ao fazer upload. Tente novamente.');
      setUploading(false);
      return;
    }
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    onChange(data.publicUrl);
    setUploading(false);
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  function applyUrl() {
    if (urlInput.trim()) {
      onChange(urlInput.trim());
      setShowUrlInput(false);
      setUrlInput('');
    }
  }

  function remove() {
    onChange('');
    setError(null);
  }

  // ─── Preview state ──────────────────────────────────────────────────────────
  if (value) {
    return (
      <div className="space-y-2">
        <div className="relative w-full h-40 rounded-xl overflow-hidden border border-slate-700 group">
          <img src={value} alt="Preview" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-medium px-3 py-2 rounded-lg backdrop-blur-sm transition-colors"
            >
              <Upload className="w-3.5 h-3.5" /> Trocar foto
            </button>
            <button
              type="button"
              onClick={remove}
              className="flex items-center gap-1.5 bg-red-500/70 hover:bg-red-500 text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors"
            >
              <X className="w-3.5 h-3.5" /> Remover
            </button>
          </div>
        </div>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onInputChange} />
      </div>
    );
  }

  // ─── Upload zone ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => !uploading && inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        disabled={uploading}
        className={`w-full h-32 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-colors cursor-pointer ${
          dragging
            ? 'border-amber-400 bg-amber-500/10'
            : 'border-slate-600 hover:border-amber-500 hover:bg-amber-500/5 bg-slate-800/40'
        } ${uploading ? 'cursor-not-allowed opacity-70' : ''}`}
      >
        {uploading ? (
          <>
            <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
            <span className="text-xs text-slate-400">Enviando...</span>
          </>
        ) : (
          <>
            <ImageIcon className="w-6 h-6 text-slate-500" />
            <span className="text-xs text-slate-400 text-center px-4">
              Clique para selecionar ou arraste uma imagem aqui
            </span>
            <span className="text-[10px] text-slate-600">JPG, PNG, WebP ou GIF · máx. 5 MB</span>
          </>
        )}
      </button>

      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onInputChange} />

      {error && <p className="text-xs text-red-400">{error}</p>}

      {/* URL fallback */}
      {!showUrlInput ? (
        <button
          type="button"
          onClick={() => setShowUrlInput(true)}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          <Link className="w-3 h-3" /> Ou cole uma URL de imagem
        </button>
      ) : (
        <div className="flex gap-2">
          <input
            autoFocus
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') applyUrl(); if (e.key === 'Escape') setShowUrlInput(false); }}
            placeholder="https://..."
            className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-amber-500 transition-colors"
          />
          <button type="button" onClick={applyUrl} className="bg-amber-500 hover:bg-amber-400 text-black text-xs font-semibold px-3 rounded-xl transition-colors">OK</button>
          <button type="button" onClick={() => setShowUrlInput(false)} className="text-slate-500 hover:text-white px-2"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}
    </div>
  );
}
