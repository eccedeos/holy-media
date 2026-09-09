import { useState } from 'react';
import { Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { QrCode } from '@/components/presentation/qr-code';
import { usePresentationStore } from '@/store/presentation-store';

const fieldClass =
  'w-full rounded-md border border-line bg-surface-sunken ' +
  'px-3 py-2 text-sm outline-none placeholder:text-content-muted ' +
  'focus-visible:ring-2 focus-visible:ring-accent';

const labelClass = 'mb-1 block text-xs font-medium text-content-muted';

/**
 * QR Code avulso -- o caso de uso pedido no roadmap e' a chave PIX da oferta,
 * mas o payload e' texto livre: serve para qualquer URL ou codigo que a
 * congregacao deva escanear.
 *
 * A previa aqui usa o mesmo componente `QrCode` que a projecao real, para o
 * operador conferir que o codigo escaneia certo *antes* de coloca-lo na
 * tela -- um QR Code errado na frente da igreja nao tem como ser corrigido
 * rapido.
 */
export function QrPanel() {
  const [title, setTitle] = useState('');
  const [payload, setPayload] = useState('');
  const presentQr = usePresentationStore((state) => state.presentQr);
  const error = usePresentationStore((state) => state.error);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (payload.trim() === '') return;
    void presentQr(title, payload);
  };

  return (
    <form
      onSubmit={handleSubmit}
      aria-label="QR Code"
      className="flex h-full min-h-0 flex-col gap-3 p-4"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">QR Code</h2>
        <Button type="submit" size="sm" disabled={payload.trim() === ''}>
          <Play className="size-4" aria-hidden />
          Apresentar
        </Button>
      </div>

      <div>
        <label htmlFor="qr-title" className={labelClass}>
          Titulo (so' para o operador)
        </label>
        <input
          id="qr-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="PIX da oferta"
          className={fieldClass}
        />
      </div>

      <div>
        <label htmlFor="qr-payload" className={labelClass}>
          Conteudo do codigo
        </label>
        <textarea
          id="qr-payload"
          value={payload}
          onChange={(event) => setPayload(event.target.value)}
          placeholder="Chave PIX, link ou qualquer texto"
          spellCheck={false}
          rows={4}
          className={`${fieldClass} resize-none font-mono`}
        />
      </div>

      {payload.trim() !== '' && (
        <div className="flex flex-1 items-center justify-center py-2">
          <QrCode payload={payload} className="h-40" />
        </div>
      )}

      {error !== null && (
        <p role="alert" className="text-xs text-live">
          {error.message}
        </p>
      )}
    </form>
  );
}
