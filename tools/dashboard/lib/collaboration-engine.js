import { EventEmitter } from 'events';

class CollaborationEngine extends EventEmitter {
  constructor() {
    super();
    this.sessions = new Map();
    this.documents = new Map();
    this.operations = new Map();
  }

  createSession(userId, documentId) {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const session = {
      id: sessionId,
      userId,
      documentId,
      connectedAt: Date.now(),
      cursor: null,
      selection: null
    };
    
    this.sessions.set(sessionId, session);
    this.emit('session:created', session);
    return session;
  }

  destroySession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.sessions.delete(sessionId);
      this.emit('session:destroyed', session);
    }
  }

  getActiveSessions(documentId) {
    return Array.from(this.sessions.values())
      .filter(s => s.documentId === documentId);
  }

  applyOperation(documentId, operation) {
    if (!this.documents.has(documentId)) {
      this.documents.set(documentId, { content: '', version: 0 });
    }

    const doc = this.documents.get(documentId);
    
    // Simple OT: Insert, Delete, Replace operations
    switch (operation.type) {
      case 'insert':
        doc.content = doc.content.slice(0, operation.position) + 
                      operation.text + 
                      doc.content.slice(operation.position);
        break;
      case 'delete':
        doc.content = doc.content.slice(0, operation.position) + 
                      doc.content.slice(operation.position + operation.length);
        break;
      case 'replace':
        doc.content = operation.text;
        break;
    }

    doc.version++;
    
    if (!this.operations.has(documentId)) {
      this.operations.set(documentId, []);
    }
    this.operations.get(documentId).push({
      ...operation,
      version: doc.version,
      timestamp: Date.now()
    });

    this.emit('operation:applied', { documentId, operation, version: doc.version });
    
    return doc;
  }

  getDocument(documentId) {
    return this.documents.get(documentId);
  }

  updateCursor(sessionId, cursor) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.cursor = cursor;
      this.emit('cursor:updated', { sessionId, cursor });
    }
  }

  updateSelection(sessionId, selection) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.selection = selection;
      this.emit('selection:updated', { sessionId, selection });
    }
  }

  getOperationHistory(documentId, fromVersion = 0) {
    const ops = this.operations.get(documentId) || [];
    return ops.filter(op => op.version > fromVersion);
  }
}

export default CollaborationEngine;
