/**
 * SCORM Runtime API — Injected into the SCORM player iframe's parent window.
 *
 * Implements both SCORM 1.2 (window.API) and SCORM 2004 (window.API_1484_11).
 * Communicates with the LMS backend via REST endpoints.
 */
(function () {
  'use strict';

  // ─── Error codes ────────────────────────────
  var NO_ERROR = 0;
  var GENERAL_ERROR = 101;
  var NOT_INITIALIZED = 301;
  var ALREADY_INITIALIZED = 302;
  var ALREADY_TERMINATED = 303;

  var errorMessages = {};
  errorMessages[NO_ERROR] = 'No error';
  errorMessages[GENERAL_ERROR] = 'General exception';
  errorMessages[NOT_INITIALIZED] = 'Not initialized';
  errorMessages[ALREADY_INITIALIZED] = 'Already initialized';
  errorMessages[ALREADY_TERMINATED] = 'Already terminated';

  // ─── ScormRuntime class ─────────────────────

  function ScormRuntime(config) {
    this.packageId = config.packageId;
    this.apiBaseUrl = config.apiBaseUrl || '/api';
    this._initialized = false;
    this._terminated = false;
    this._lastError = NO_ERROR;
    this._cmiData = {};
    this._dirty = false;
    this._commitTimer = null;
    this._onStatusChange = config.onStatusChange || null;
  }

  ScormRuntime.prototype._setError = function (code) {
    this._lastError = code;
  };

  ScormRuntime.prototype._apiUrl = function (path) {
    return this.apiBaseUrl + '/scorm/' + this.packageId + path;
  };

  ScormRuntime.prototype._syncRequest = function (method, url, body) {
    var xhr = new XMLHttpRequest();
    xhr.open(method, url, false); // synchronous — required by SCORM spec
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.withCredentials = true;
    try {
      xhr.send(body ? JSON.stringify(body) : null);
      if (xhr.status >= 200 && xhr.status < 300) {
        return JSON.parse(xhr.responseText);
      }
    } catch (e) {
      console.warn('[SCORM Runtime] Request failed:', e);
    }
    return null;
  };

  ScormRuntime.prototype._asyncRequest = function (method, url, body) {
    var xhr = new XMLHttpRequest();
    xhr.open(method, url, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.withCredentials = true;
    xhr.send(body ? JSON.stringify(body) : null);
  };

  // ─── Core operations ────────────────────────

  ScormRuntime.prototype.initialize = function () {
    if (this._initialized) {
      this._setError(ALREADY_INITIALIZED);
      return 'false';
    }
    if (this._terminated) {
      this._setError(ALREADY_TERMINATED);
      return 'false';
    }

    var result = this._syncRequest('GET', this._apiUrl('/runtime-data'));
    if (result) {
      // Handle response envelope: backend wraps in { data: ... }
      var data = result.data || result;
      this._cmiData = data.cmiData || {};
      // Pre-populate from saved state
      if (data.suspendData) this._cmiData['cmi.suspend_data'] = data.suspendData;
      if (data.location) this._cmiData['cmi.location'] = data.location;
      if (data.score != null) this._cmiData['cmi.core.score.raw'] = String(data.score);
      if (data.status && data.status !== 'not attempted') {
        this._cmiData['cmi.core.lesson_status'] = data.status;
      }
      if (data.totalTime) this._cmiData['cmi.core.total_time'] = data.totalTime;
    }

    this._initialized = true;
    this._setError(NO_ERROR);
    return 'true';
  };

  ScormRuntime.prototype.getValue = function (key) {
    if (!this._initialized) {
      this._setError(NOT_INITIALIZED);
      return '';
    }
    this._setError(NO_ERROR);
    var val = this._cmiData[key];
    return val !== undefined ? String(val) : '';
  };

  ScormRuntime.prototype.setValue = function (key, value) {
    if (!this._initialized) {
      this._setError(NOT_INITIALIZED);
      return 'false';
    }
    this._cmiData[key] = value;
    this._dirty = true;
    this._setError(NO_ERROR);

    // Auto-commit after 2 seconds of inactivity
    if (this._commitTimer) clearTimeout(this._commitTimer);
    var self = this;
    this._commitTimer = setTimeout(function () {
      self.commit();
    }, 2000);

    return 'true';
  };

  ScormRuntime.prototype.commit = function () {
    if (!this._initialized) {
      this._setError(NOT_INITIALIZED);
      return 'false';
    }
    if (!this._dirty) {
      this._setError(NO_ERROR);
      return 'true';
    }

    var status = this._cmiData['cmi.core.lesson_status'] ||
                 this._cmiData['cmi.completion_status'] || undefined;
    var scoreRaw = this._cmiData['cmi.core.score.raw'] ||
                   this._cmiData['cmi.score.raw'] || undefined;

    var body = {
      cmiData: this._cmiData,
      suspendData: this._cmiData['cmi.suspend_data'] || undefined,
      location: this._cmiData['cmi.location'] ||
                this._cmiData['cmi.core.lesson_location'] || undefined,
      score: scoreRaw != null ? parseFloat(scoreRaw) : undefined,
      status: status,
      totalTime: this._cmiData['cmi.core.total_time'] ||
                 this._cmiData['cmi.total_time'] || undefined,
    };

    this._asyncRequest('PUT', this._apiUrl('/runtime-data'), body);
    this._dirty = false;
    this._setError(NO_ERROR);

    // Notify parent about status changes
    if (status && this._onStatusChange) {
      this._onStatusChange(status);
    }

    return 'true';
  };

  ScormRuntime.prototype.finish = function () {
    if (!this._initialized) {
      this._setError(NOT_INITIALIZED);
      return 'false';
    }
    if (this._terminated) {
      this._setError(ALREADY_TERMINATED);
      return 'false';
    }

    if (this._commitTimer) clearTimeout(this._commitTimer);
    this._dirty = true; // force a final commit
    this.commit();
    this._terminated = true;
    this._initialized = false;
    this._setError(NO_ERROR);
    return 'true';
  };

  ScormRuntime.prototype.getLastError = function () {
    return String(this._lastError);
  };

  ScormRuntime.prototype.getErrorString = function (code) {
    return errorMessages[parseInt(code, 10)] || 'Unknown error';
  };

  ScormRuntime.prototype.getDiagnostic = function (code) {
    return this.getErrorString(code);
  };

  // ─── SCORM 1.2 API ─────────────────────────

  ScormRuntime.prototype.createSCORM12API = function () {
    var rt = this;
    return {
      LMSInitialize: function () { return rt.initialize(); },
      LMSGetValue: function (key) { return rt.getValue(key); },
      LMSSetValue: function (key, value) { return rt.setValue(key, value); },
      LMSCommit: function () { return rt.commit(); },
      LMSFinish: function () { return rt.finish(); },
      LMSGetLastError: function () { return rt.getLastError(); },
      LMSGetErrorString: function (code) { return rt.getErrorString(code); },
      LMSGetDiagnostic: function (code) { return rt.getDiagnostic(code); },
    };
  };

  // ─── SCORM 2004 API ────────────────────────

  ScormRuntime.prototype.createSCORM2004API = function () {
    var rt = this;
    return {
      Initialize: function () { return rt.initialize(); },
      GetValue: function (key) { return rt.getValue(key); },
      SetValue: function (key, value) { return rt.setValue(key, value); },
      Commit: function () { return rt.commit(); },
      Terminate: function () { return rt.finish(); },
      GetLastError: function () { return rt.getLastError(); },
      GetErrorString: function (code) { return rt.getErrorString(code); },
      GetDiagnostic: function (code) { return rt.getDiagnostic(code); },
    };
  };

  // ─── Install on window ─────────────────────

  ScormRuntime.prototype.install = function () {
    window.API = this.createSCORM12API();
    window.API_1484_11 = this.createSCORM2004API();
  };

  // Export
  window.ScormRuntime = ScormRuntime;
})();
