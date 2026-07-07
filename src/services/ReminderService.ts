import notifee, { TriggerType, AndroidImportance } from '@notifee/react-native';
import { ScannedDocument, ID_TYPES } from '../types';
import { StorageService } from './StorageService';
import { parseFlexibleDate, daysUntil } from '../utils/DateParser';

const CHANNEL_ID = 'expiry-reminders';
const REMINDER_DAYS = [30, 7, 1];

const ensureChannel = async (): Promise<void> => {
  await notifee.createChannel({
    id: CHANNEL_ID,
    name: 'Document Expiry Reminders',
    importance: AndroidImportance.HIGH,
  });
};

const requestPermission = async (): Promise<boolean> => {
  const settings = await notifee.requestPermission();
  return settings.authorizationStatus >= 1;
};

/** Documents with an ID expiration date within `withinDays` (including already expired). */
export interface ExpiringDoc {
  document: ScannedDocument;
  expiresOn: Date;
  daysLeft: number;
}

const getExpiringDocuments = async (withinDays = 30): Promise<ExpiringDoc[]> => {
  const docs = await StorageService.getAllDocuments();
  const results: ExpiringDoc[] = [];
  for (const doc of docs) {
    if (!ID_TYPES.includes(doc.type)) continue;
    const expiresOn = parseFlexibleDate(doc.extractedData?.expirationDate);
    if (!expiresOn) continue;
    const daysLeft = daysUntil(expiresOn);
    if (daysLeft <= withinDays) {
      results.push({ document: doc, expiresOn, daysLeft });
    }
  }
  return results.sort((a, b) => a.daysLeft - b.daysLeft);
};

/**
 * Schedules local notifications for every ID document nearing its
 * expiration date (30/7/1 days out). Existing reminders for a document
 * are cancelled first so repeated calls never create duplicates.
 * Entirely on-device — no server, no data leaves the phone.
 */
const scheduleExpiryReminders = async (): Promise<void> => {
  const granted = await requestPermission();
  if (!granted) return;
  await ensureChannel();

  const docs = await StorageService.getAllDocuments();
  for (const doc of docs) {
    if (!ID_TYPES.includes(doc.type)) continue;
    const expiresOn = parseFlexibleDate(doc.extractedData?.expirationDate);

    // Always clear old reminders for this document first.
    for (const days of REMINDER_DAYS) {
      try {
        await notifee.cancelNotification(`expiry-${doc.id}-${days}`);
      } catch {}
    }
    if (!expiresOn) continue;

    for (const days of REMINDER_DAYS) {
      const fireDate = new Date(expiresOn);
      fireDate.setDate(fireDate.getDate() - days);
      fireDate.setHours(9, 0, 0, 0);
      if (fireDate.getTime() <= Date.now()) continue;

      await notifee.createTriggerNotification(
        {
          id: `expiry-${doc.id}-${days}`,
          title: '🪪 Document expiring soon',
          body:
            days === 1
              ? `"${doc.title}" expires tomorrow.`
              : `"${doc.title}" expires in ${days} days.`,
          android: { channelId: CHANNEL_ID, pressAction: { id: 'default' } },
        },
        { type: TriggerType.TIMESTAMP, timestamp: fireDate.getTime() },
      );
    }
  }
};

export const ReminderService = {
  scheduleExpiryReminders,
  getExpiringDocuments,
};
