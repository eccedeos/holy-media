import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Service, ServiceSummary } from '@holy-media/types';
import { resetServicesStore, useServicesStore } from './services-store';
import { createAppError } from '@/lib/ipc';
import * as api from '@/lib/services-api';

vi.mock('@/lib/services-api');

function resumo(id: string, title: string, itemCount = 0): ServiceSummary {
  return { id, title, itemCount, updatedAt: 1 };
}

function servico(id: string, title: string, items: Service['items'] = []): Service {
  return { id, title, items, createdAt: 1, updatedAt: 1 };
}

beforeEach(() => {
  vi.resetAllMocks();
  resetServicesStore();
  vi.mocked(api.listServices).mockResolvedValue([]);
});

describe('lista', () => {
  it('carrega os cultos salvos', async () => {
    vi.mocked(api.listServices).mockResolvedValue([resumo('1', 'Culto de Domingo')]);

    await useServicesStore.getState().refresh();

    expect(useServicesStore.getState().services).toHaveLength(1);
  });

  it('fica vazia sem alarmar quando roda fora do Tauri', async () => {
    vi.mocked(api.listServices).mockRejectedValue(
      createAppError('IPC_UNAVAILABLE', 'fora do Tauri'),
    );

    await useServicesStore.getState().refresh();

    expect(useServicesStore.getState().services).toEqual([]);
    expect(useServicesStore.getState().error).toBeNull();
  });
});

describe('criar e selecionar', () => {
  it('abre o culto criado e atualiza a lista', async () => {
    const criado = servico('1', 'Culto de Domingo');
    vi.mocked(api.createService).mockResolvedValue(criado);
    vi.mocked(api.listServices).mockResolvedValue([resumo('1', 'Culto de Domingo')]);

    await useServicesStore.getState().create('Culto de Domingo');

    expect(useServicesStore.getState().active).toEqual(criado);
    expect(api.listServices).toHaveBeenCalled();
  });

  it('seleciona um culto salvo', async () => {
    const salvo = servico('1', 'Culto de Domingo');
    vi.mocked(api.getService).mockResolvedValue(salvo);

    await useServicesStore.getState().select('1');

    expect(useServicesStore.getState().active).toEqual(salvo);
  });
});

describe('adicionar musica', () => {
  it('cria um culto com titulo padrao quando nao ha nenhum ativo', async () => {
    const criado = servico('1', 'Ordem do culto');
    vi.mocked(api.createService).mockResolvedValue(criado);
    vi.mocked(api.addSongToService).mockResolvedValue(
      servico('1', 'Ordem do culto', [
        { id: 'item-1', position: 0, kind: 'song', referenceId: 'musica-1', title: 'Aleluia' },
      ]),
    );

    await useServicesStore.getState().addSong('musica-1');

    expect(api.createService).toHaveBeenCalledWith({ title: 'Ordem do culto' });
    expect(api.addSongToService).toHaveBeenCalledWith('1', 'musica-1');
    expect(useServicesStore.getState().active?.items).toHaveLength(1);
  });

  it('acrescenta ao culto ja ativo, sem criar outro', async () => {
    useServicesStore.setState({ active: servico('1', 'Culto') });
    vi.mocked(api.addSongToService).mockResolvedValue(
      servico('1', 'Culto', [
        { id: 'item-1', position: 0, kind: 'song', referenceId: 'musica-1', title: 'Aleluia' },
      ]),
    );

    await useServicesStore.getState().addSong('musica-1');

    expect(api.createService).not.toHaveBeenCalled();
    expect(api.addSongToService).toHaveBeenCalledWith('1', 'musica-1');
  });
});

describe('itens', () => {
  it('remove um item do culto ativo', async () => {
    useServicesStore.setState({ active: servico('1', 'Culto') });
    vi.mocked(api.removeServiceItem).mockResolvedValue(servico('1', 'Culto'));

    await useServicesStore.getState().removeItem('item-1');

    expect(api.removeServiceItem).toHaveBeenCalledWith('1', 'item-1');
  });

  it('nao faz nada quando nao ha culto ativo', async () => {
    await useServicesStore.getState().removeItem('item-1');

    expect(api.removeServiceItem).not.toHaveBeenCalled();
  });

  it('duplica um item', async () => {
    useServicesStore.setState({ active: servico('1', 'Culto') });
    vi.mocked(api.duplicateServiceItem).mockResolvedValue(servico('1', 'Culto'));

    await useServicesStore.getState().duplicateItem('item-1');

    expect(api.duplicateServiceItem).toHaveBeenCalledWith('1', 'item-1');
  });

  it('move um item para outra posicao', async () => {
    useServicesStore.setState({ active: servico('1', 'Culto') });
    vi.mocked(api.moveServiceItem).mockResolvedValue(servico('1', 'Culto'));

    await useServicesStore.getState().moveItem('item-1', 2);

    expect(api.moveServiceItem).toHaveBeenCalledWith('1', 'item-1', 2);
  });

  it('guarda o erro do nucleo sem apagar o culto ativo', async () => {
    const ativo = servico('1', 'Culto');
    useServicesStore.setState({ active: ativo });
    vi.mocked(api.moveServiceItem).mockRejectedValue(
      createAppError('INVALID_INPUT', undefined, 'Posicao invalida na ordem do culto.'),
    );

    await useServicesStore.getState().moveItem('item-1', 99);

    expect(useServicesStore.getState().error?.message).toBe('Posicao invalida na ordem do culto.');
    expect(useServicesStore.getState().active).toEqual(ativo);
  });
});

describe('excluir', () => {
  it('fecha o culto ativo quando ele e o excluido', async () => {
    useServicesStore.setState({ active: servico('1', 'Culto') });
    vi.mocked(api.deleteService).mockResolvedValue(undefined);

    await useServicesStore.getState().remove('1');

    expect(useServicesStore.getState().active).toBeNull();
  });

  it('mantem o culto ativo ao excluir outro', async () => {
    const ativo = servico('1', 'Culto');
    useServicesStore.setState({ active: ativo });
    vi.mocked(api.deleteService).mockResolvedValue(undefined);

    await useServicesStore.getState().remove('2');

    expect(useServicesStore.getState().active).toEqual(ativo);
  });
});
