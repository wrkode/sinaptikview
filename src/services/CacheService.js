/**
 * CacheService.js
 * A simple client-side caching service with TTL support to reduce API calls
 */

class CacheService {
  constructor() {
    this.cache = new Map();
    this.defaultTTL = 30000; // 30 seconds default TTL
  }

  /**
   * Set a value in the cache with optional TTL
   * @param {string} key - The cache key
   * @param {any} value - The value to store
   * @param {number} ttl - Time to live in milliseconds (optional)
   */
  set(key, value, ttl = this.defaultTTL) {
    const expiry = Date.now() + ttl;
    const item = {
      value,
      expiry
    };
    
    this.cache.set(key, item);
    return value;
  }

  /**
   * Get a value from the cache
   * @param {string} key - The cache key
   * @returns {any|null} The cached value or null if not found/expired
   */
  get(key) {
    const item = this.cache.get(key);
    
    // Return null if item doesn't exist
    if (!item) return null;
    
    // Return null if item is expired and remove it
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    return item.value;
  }

  /**
   * Check if a key exists in the cache and is not expired
   * @param {string} key - The cache key
   * @returns {boolean} Whether the key exists and is valid
   */
  has(key) {
    const item = this.cache.get(key);
    
    if (!item) return false;
    
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * Delete a specific key from the cache
   * @param {string} key - The cache key
   */
  delete(key) {
    this.cache.delete(key);
  }

  /**
   * Clear all items from the cache
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Get a cached response or fetch it
   * @param {string} key - Cache key
   * @param {Function} fetchFn - Async function to fetch data if not cached
   * @param {number} ttl - Optional TTL in milliseconds
   * @returns {Promise<any>} The cached or freshly fetched data
   */
  async getOrFetch(key, fetchFn, ttl = this.defaultTTL) {
    const cachedValue = this.get(key);
    
    if (cachedValue !== null) {
      return cachedValue;
    }
    
    try {
      const freshValue = await fetchFn();
      return this.set(key, freshValue, ttl);
    } catch (error) {
      console.error(`Error fetching data for key ${key}:`, error);
      throw error;
    }
  }
}

// Create a singleton instance
const cacheService = new CacheService();

export default cacheService; 