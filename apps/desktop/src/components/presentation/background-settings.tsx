import { useEffect, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import type { BackgroundKind } from '@holy-media/types';
import { useBackgroundStore } from '@/store/background-store';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { cn } from '@/lib/utils';
import { createLogger } from '@/lib/logger';

const log = createLogger('background');

const TABS: { kind: BackgroundKind; label: string }[] = [
  { kind: 'color', label: 'Cor' },
  { kind: 'gradient', label: 'Gradiente' },
  { kind: 'image', label: 'Imagem' },
];

/** Tamanho maximo aceito no seletor de arquivo, em bytes.
 *
 * Corresponde (com folga, ja que base64 infla ~33%) ao limite que o nucleo
 * aplica ao dado ja codificado -- ver `MAX_IMAGE_DATA_LEN` em
 * `background/model.rs`. Rejeitar aqui evita gastar o IPC com um arquivo que
 * o nucleo so' recusaria depois.
 */
const MAX_IMAGE_BYTES = 4_400_000;

/**
 * Troca do fundo da projecao: cor solida, gradiente ou imagem.
 *
 * Fica na coluna do operador, junto dos outros controles que valem para
 * qualquer conteudo -- o fundo nao pertence a musica, a Biblia, a texto ou a
 * QR Code, e' um efeito visual da propria tela de projecao.
 */
export function BackgroundSettings() {
  const settings = useBackgroundStore((store) => store.settings);
  const error = useBackgroundStore((store) => store.error);
  const connect = useBackgroundStore((store) => store.connect);
  const setColor = useBackgroundStore((store) => store.setColor);
  const setGradient = useBackgroundStore((store) => store.setGradient);
  const setImage = useBackgroundStore((store) => store.setImage);

  const [tab, setTab] = useState<BackgroundKind>(settings.kind);
  const [color, setColorDraft] = useState(settings.color ?? '#000000');
  const [gradientFrom, setGradientFrom] = useState(settings.gradientFrom ?? '#1e1e2f');
  const [gradientTo, setGradientTo] = useState(settings.gradientTo ?? '#4b3b6b');
  const [angle, setAngle] = useState(settings.gradientAngle ?? 180);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void connect();
  }, [connect]);

  // O rascunho segue o que o nucleo confirmou -- tanto a primeira leitura
  // (que so' chega depois do `connect` acima) quanto uma troca vinda de outra
  // janela. Ajuste durante o render (nao dentro de um efeito): e' o padrao
  // recomendado para "resetar estado quando algo de fora mudou", sem o
  // re-render extra de um efeito so' para sincronizar.
  const [ultimoSettingsVisto, setUltimoSettingsVisto] = useState(settings);
  if (ultimoSettingsVisto !== settings) {
    setUltimoSettingsVisto(settings);
    setTab(settings.kind);
    if (settings.color !== null) setColorDraft(settings.color);
    if (settings.gradientFrom !== null) setGradientFrom(settings.gradientFrom);
    if (settings.gradientTo !== null) setGradientTo(settings.gradientTo);
    if (settings.gradientAngle !== null) setAngle(settings.gradientAngle);
  }

  const debouncedColor = useDebouncedValue(color);
  const debouncedGradient = useDebouncedValue(`${gradientFrom}|${gradientTo}|${angle}`);

  useEffect(() => {
    if (tab === 'color' && debouncedColor !== settings.color) {
      void setColor(debouncedColor);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedColor, tab]);

  useEffect(() => {
    if (tab !== 'gradient') return;
    const changed =
      gradientFrom !== settings.gradientFrom ||
      gradientTo !== settings.gradientTo ||
      angle !== settings.gradientAngle;
    if (changed) void setGradient(gradientFrom, gradientTo, angle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedGradient, tab]);

  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file === undefined) return;

    setFileError(null);
    if (file.size > MAX_IMAGE_BYTES) {
      setFileError('Imagem muito grande. Escolha um arquivo menor.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      if (!dataUrl.startsWith('data:image/')) {
        setFileError('Escolha um arquivo de imagem.');
        return;
      }
      void setImage(dataUrl);
    };
    reader.onerror = () => {
      log.error('falha ao ler o arquivo de imagem');
      setFileError('Nao foi possivel ler o arquivo.');
    };
    reader.readAsDataURL(file);
  };

  return (
    <section
      aria-label="Fundo da projecao"
      className="flex flex-col gap-2 border-b border-line p-3"
    >
      <h2 className="text-xs font-medium uppercase tracking-wide text-content-muted">Fundo</h2>

      <div role="tablist" aria-label="Tipo de fundo" className="flex gap-1">
        {TABS.map(({ kind, label }) => (
          <button
            key={kind}
            type="button"
            role="tab"
            aria-selected={tab === kind}
            onClick={() => setTab(kind)}
            className={cn(
              'flex-1 rounded-md border px-2 py-1 text-xs',
              tab === kind
                ? 'border-accent bg-surface-raised text-accent'
                : 'border-line text-content-muted hover:bg-surface-raised',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'color' && (
        <div className="flex items-center gap-2">
          <input
            type="color"
            aria-label="Cor de fundo"
            value={color}
            onChange={(event) => setColorDraft(event.target.value)}
            className="h-8 w-10 rounded border border-line bg-transparent"
          />
          <span className="text-xs text-content-muted">{color}</span>
        </div>
      )}

      {tab === 'gradient' && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <input
              type="color"
              aria-label="Primeira cor do gradiente"
              value={gradientFrom}
              onChange={(event) => setGradientFrom(event.target.value)}
              className="h-8 w-10 rounded border border-line bg-transparent"
            />
            <input
              type="color"
              aria-label="Segunda cor do gradiente"
              value={gradientTo}
              onChange={(event) => setGradientTo(event.target.value)}
              className="h-8 w-10 rounded border border-line bg-transparent"
            />
            <label className="flex flex-1 items-center gap-2 text-xs text-content-muted">
              Angulo
              <input
                type="range"
                min={0}
                max={360}
                value={angle}
                aria-label="Angulo do gradiente"
                onChange={(event) => setAngle(Number(event.target.value))}
                className="flex-1"
              />
              {angle}°
            </label>
          </div>
          <div
            className="h-6 w-full rounded-md"
            style={{ background: `linear-gradient(${angle}deg, ${gradientFrom}, ${gradientTo})` }}
            aria-hidden
          />
        </div>
      )}

      {tab === 'image' && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-2 rounded-md border border-dashed border-line px-3 py-2 text-xs text-content-muted hover:bg-surface-raised"
          >
            <Upload className="size-4" aria-hidden />
            Escolher imagem
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            aria-label="Escolher imagem de fundo"
            onChange={handleFile}
          />
          {settings.kind === 'image' && settings.imageData !== null && (
            <img
              src={settings.imageData}
              alt="Fundo atual"
              className="h-16 w-full rounded-md object-cover"
            />
          )}
          {fileError !== null && (
            <p role="alert" className="text-xs text-live">
              {fileError}
            </p>
          )}
        </div>
      )}

      {error !== null && (
        <p role="alert" className="text-xs text-live">
          {error.message}
        </p>
      )}
    </section>
  );
}
