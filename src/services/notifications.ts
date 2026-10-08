import { soundService } from './sound';

class NotificationService {
  private hasPermission: boolean = false;

  constructor() {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      this.hasPermission = Notification.permission === 'granted';
    }
  }

  public async requestPermission(): Promise<boolean> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return false;
    }
    try {
      const permission = await Notification.requestPermission();
      this.hasPermission = permission === 'granted';
      return this.hasPermission;
    } catch {
      return false;
    }
  }

  public getPermissionStatus(): NotificationPermission | 'unsupported' {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported';
    }
    return Notification.permission;
  }

  public notifyAlmostUp(number: string, peopleAhead: number) {
    soundService.playChime();
    this.vibrate([100, 50, 100]);

    if (this.hasPermission && 'Notification' in window) {
      new Notification("You're almost up! | Queue Turn", {
        body: `Number ${number}: Only ${peopleAhead} ${peopleAhead === 1 ? 'person' : 'people'} ahead of you. Please stay close to the counter.`,
        icon: '/favicon.ico',
        tag: 'queue-almost-up',
      });
    }
  }

  public notifyYourTurn(number: string, counterName?: string) {
    soundService.announceTurn(number, counterName);
    this.vibrate([300, 100, 300, 100, 500]);

    if (this.hasPermission && 'Notification' in window) {
      new Notification("🎉 It's Your Turn! | Queue Turn", {
        body: counterName 
          ? `Number ${number}: Please proceed to ${counterName}.`
          : `Number ${number}: Please proceed to the service counter.`,
        icon: '/favicon.ico',
        requireInteraction: true,
        tag: 'queue-your-turn',
      });
    }
  }

  public vibrate(pattern: number[]) {
    if (typeof window !== 'undefined' && 'navigator' in window && 'vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch {
        // Ignore vibration errors
      }
    }
  }

  /**
   * SMS Notification Provider Abstraction (e.g., Twilio, MessageBird, AWS SNS)
   * Ready for plug-and-play backend API integration
   */
  public async sendSmsSimulation(phone: string, message: string): Promise<{ success: boolean; id: string }> {
    console.log(`[Queue Turn SMS Provider] Dispatching SMS to ${phone}: "${message}"`);
    // Simulated SMS dispatch
    return {
      success: true,
      id: 'sms_' + Math.random().toString(36).substr(2, 9),
    };
  }
}

export const notificationService = new NotificationService();
