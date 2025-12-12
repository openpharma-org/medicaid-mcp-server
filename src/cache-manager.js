/**
 * CSV Data Cache Manager for Medicaid MCP Server
 *
 * Handles in-memory caching with TTL for large CSV datasets
 * Implements download, parse, and cache with automatic expiration
 */

const axios = require('axios');

class CacheManager {
  constructor() {
    this.memory = {};
    this.ttls = {};
    this.metadata = {};
  }

  /**
   * Get data from cache or fetch via provided function
   * @param {string} key - Cache key
   * @param {Function} fetchFn - Async function to fetch data if not cached
   * @param {number} ttl - Time to live in milliseconds (default: 1 hour)
   * @returns {Promise<any>} Cached or freshly fetched data
   */
  async get(key, fetchFn, ttl = 3600000) {
    // Check if cached and not expired
    if (this.memory[key] && Date.now() < this.ttls[key]) {
      console.log(`[Cache HIT] ${key} (${this.metadata[key].records} records)`);
      return this.memory[key];
    }

    // Cache miss or expired - fetch new data
    console.log(`[Cache MISS] ${key} - fetching...`);
    const startTime = Date.now();

    const data = await fetchFn();

    const elapsed = Date.now() - startTime;
    this.memory[key] = data;
    this.ttls[key] = Date.now() + ttl;
    this.metadata[key] = {
      records: Array.isArray(data) ? data.length : 0,
      fetchedAt: new Date().toISOString(),
      fetchDuration: elapsed
    };

    console.log(`[Cache SET] ${key} (${this.metadata[key].records} records, ${elapsed}ms)`);

    return data;
  }

  /**
   * Invalidate specific cache entry
   * @param {string} key - Cache key to invalidate
   */
  invalidate(key) {
    if (this.memory[key]) {
      delete this.memory[key];
      delete this.ttls[key];
      delete this.metadata[key];
      console.log(`[Cache INVALIDATE] ${key}`);
    }
  }

  /**
   * Clear all cache entries
   */
  clear() {
    this.memory = {};
    this.ttls = {};
    this.metadata = {};
    console.log('[Cache CLEAR] All entries cleared');
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  getStats() {
    const entries = Object.keys(this.memory);
    return {
      entries: entries.length,
      totalRecords: entries.reduce((sum, key) => sum + (this.metadata[key]?.records || 0), 0),
      details: entries.map(key => ({
        key,
        records: this.metadata[key]?.records,
        fetchedAt: this.metadata[key]?.fetchedAt,
        expiresAt: new Date(this.ttls[key]).toISOString(),
        isExpired: Date.now() >= this.ttls[key]
      }))
    };
  }

  /**
   * Download CSV file from URL with progress tracking
   * @param {string} url - CSV download URL
   * @param {string} datasetName - Dataset name for logging
   * @returns {Promise<string>} CSV content as string
   */
  async downloadCSV(url, datasetName = 'dataset') {
    try {
      const response = await axios.get(url, {
        timeout: 300000, // 5 minutes
        maxContentLength: 500 * 1024 * 1024, // 500MB max (Phase 3 datasets are huge)
        onDownloadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            const mb = (progressEvent.loaded / 1024 / 1024).toFixed(2);
            if (percent % 10 === 0) { // Log every 10%
              console.log(`[Download] ${datasetName}: ${percent}% (${mb} MB)`);
            }
          }
        }
      });

      const sizeInMB = (Buffer.byteLength(response.data) / (1024 * 1024)).toFixed(2);
      console.log(`[Download COMPLETE] ${datasetName}: ${sizeInMB} MB`);

      return response.data;
    } catch (error) {
      console.error(`[Download ERROR] ${datasetName}:`, error.message);
      throw new Error(`Failed to download ${datasetName}: ${error.message}`);
    }
  }

  /**
   * Parse CSV string to array of objects
   * @param {string} csvData - CSV content
   * @returns {Array<Object>} Parsed records
   */
  parseCSV(csvData) {
    const lines = csvData.split('\n').filter(line => line.trim());
    if (lines.length === 0) {
      return [];
    }

    // Parse header
    const header = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));

    // Parse data rows
    const records = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;

      // Simple CSV parsing (handles quoted fields)
      const values = this._parseCSVLine(line);
      if (values.length !== header.length) {
        // Skip malformed rows
        continue;
      }

      const record = {};
      header.forEach((col, idx) => {
        record[col] = values[idx]?.trim().replace(/"/g, '') || '';
      });
      records.push(record);
    }

    return records;
  }

  /**
   * Parse single CSV line (handles quoted fields with commas)
   * @private
   */
  _parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current); // Add last value

    return values;
  }

  /**
   * Download and parse CSV in one operation
   * @param {string} url - CSV download URL
   * @param {string} datasetName - Dataset name for logging
   * @returns {Promise<Array<Object>>} Parsed records
   */
  async downloadAndParseCSV(url, datasetName) {
    const csvData = await this.downloadCSV(url, datasetName);
    const records = this.parseCSV(csvData);
    console.log(`[Parse COMPLETE] ${datasetName}: ${records.length} records`);
    return records;
  }
}

// Singleton instance
const cacheManager = new CacheManager();

module.exports = {
  CacheManager,
  cache: cacheManager
};
