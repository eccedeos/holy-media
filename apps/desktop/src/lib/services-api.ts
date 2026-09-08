import type { Service, ServiceInput, ServiceSummary } from '@holy-media/types';
import { invokeCommand } from './ipc';

/** Chamadas da ordem do culto. */

export function listServices(): Promise<ServiceSummary[]> {
  return invokeCommand<ServiceSummary[]>('services_list');
}

export function getService(id: string): Promise<Service> {
  return invokeCommand<Service>('services_get', { id });
}

export function createService(input: ServiceInput): Promise<Service> {
  return invokeCommand<Service>('services_create', { input });
}

export function renameService(id: string, input: ServiceInput): Promise<Service> {
  return invokeCommand<Service>('services_rename', { id, input });
}

export function deleteService(id: string): Promise<void> {
  return invokeCommand<void>('services_delete', { id });
}

export function addSongToService(serviceId: string, songId: string): Promise<Service> {
  return invokeCommand<Service>('services_add_song', { serviceId, songId });
}

export function removeServiceItem(serviceId: string, itemId: string): Promise<Service> {
  return invokeCommand<Service>('services_remove_item', { serviceId, itemId });
}

export function duplicateServiceItem(serviceId: string, itemId: string): Promise<Service> {
  return invokeCommand<Service>('services_duplicate_item', { serviceId, itemId });
}

export function moveServiceItem(
  serviceId: string,
  itemId: string,
  newPosition: number,
): Promise<Service> {
  return invokeCommand<Service>('services_move_item', { serviceId, itemId, newPosition });
}
