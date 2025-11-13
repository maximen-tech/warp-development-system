import { EventEmitter } from 'events';
import crypto from 'crypto';

class WebhookManager extends EventEmitter {
  constructor() {
    super();
    this.webhooks = new Map();
    this.deliveries = new Map();
  }

  registerWebhook(config) {
    const id = `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const secret = crypto.randomBytes(32).toString('hex');
    
    const webhook = {
      id,
      url: config.url,
      events: config.events || ['*'],
      secret,
      active: true,
      createdAt: Date.now()
    };
    
    this.webhooks.set(id, webhook);
    return webhook;
  }

  async triggerWebhook(event, payload) {
    const matchingWebhooks = Array.from(this.webhooks.values())
      .filter(wh => wh.active && (wh.events.includes('*') || wh.events.includes(event)));

    const deliveries = [];
    
    for (const webhook of matchingWebhooks) {
      const deliveryId = `delivery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const delivery = {
        id: deliveryId,
        webhookId: webhook.id,
        event,
        payload,
        timestamp: Date.now(),
        status: 'pending'
      };
      
      this.deliveries.set(deliveryId, delivery);
      deliveries.push(this.deliverWebhook(webhook, delivery));
    }

    return Promise.allSettled(deliveries);
  }

  async deliverWebhook(webhook, delivery) {
    try {
      const signature = this.generateSignature(webhook.secret, delivery.payload);
      
      // Simulate HTTP POST (in real implementation, use fetch/axios)
      const response = await this.mockHttpPost(webhook.url, {
        headers: {
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': delivery.event,
          'X-Webhook-Delivery': delivery.id
        },
        body: delivery.payload
      });

      delivery.status = 'success';
      delivery.responseCode = response.status;
      delivery.completedAt = Date.now();
      
      this.emit('delivery:success', delivery);
      return delivery;
    } catch (error) {
      delivery.status = 'failed';
      delivery.error = error.message;
      delivery.completedAt = Date.now();
      
      this.emit('delivery:failed', delivery, error);
      throw error;
    }
  }

  async mockHttpPost(url, options) {
    // Mock implementation - replace with actual HTTP client
    return {
      status: 200,
      data: { success: true }
    };
  }

  generateSignature(secret, payload) {
    return crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex');
  }

  verifySignature(secret, payload, signature) {
    const expected = this.generateSignature(secret, payload);
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  }

  getWebhook(id) {
    return this.webhooks.get(id);
  }

  deleteWebhook(id) {
    return this.webhooks.delete(id);
  }

  getDeliveries(webhookId, limit = 50) {
    return Array.from(this.deliveries.values())
      .filter(d => d.webhookId === webhookId)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }
}

export default WebhookManager;
