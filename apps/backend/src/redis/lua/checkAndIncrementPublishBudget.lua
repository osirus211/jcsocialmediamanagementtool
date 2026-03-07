-- checkAndIncrementPublishBudget.lua
-- Atomic publish budget check and optional increment with sliding window
--
-- KEYS[1] = global_budget_key
-- KEYS[2] = workspace_budget_key
-- KEYS[3] = platform_budget_key (empty string if disabled)
-- KEYS[4] = overload_freeze_key
--
-- ARGV[1] = current_timestamp_ms
-- ARGV[2] = global_window_ms (60000)
-- ARGV[3] = global_limit
-- ARGV[4] = workspace_limit
-- ARGV[5] = platform_limit (0 if disabled)
-- ARGV[6] = member_id ("timestamp:correlationId")
-- ARGV[7] = should_increment (1 or 0)
-- ARGV[8] = platform_window_ms (0 if disabled)
--
-- RETURN: {allowed, reason_code, retry_after_seconds, global_count, workspace_count, platform_count}
--
-- Reason codes:
-- 1 = ADMITTED
-- 2 = OVERLOAD_FREEZE
-- 3 = GLOBAL_BUDGET
-- 4 = WORKSPACE_BUDGET
-- 5 = PLATFORM_BUDGET

local global_key = KEYS[1]
local workspace_key = KEYS[2]
local platform_key = KEYS[3]
local freeze_key = KEYS[4]

local current_ts = tonumber(ARGV[1])
local global_window = tonumber(ARGV[2])
local global_limit = tonumber(ARGV[3])
local workspace_limit = tonumber(ARGV[4])
local platform_limit = tonumber(ARGV[5])
local member_id = ARGV[6]
local should_increment = tonumber(ARGV[7])
local platform_window = tonumber(ARGV[8])

-- Reason codes
local REASON_ADMITTED = 1
local REASON_OVERLOAD_FREEZE = 2
local REASON_GLOBAL_BUDGET = 3
local REASON_WORKSPACE_BUDGET = 4
local REASON_PLATFORM_BUDGET = 5

-- 1. Check overload freeze
if redis.call('EXISTS', freeze_key) == 1 then
  local freeze_ttl = redis.call('TTL', freeze_key)
  return {0, REASON_OVERLOAD_FREEZE, freeze_ttl, 0, 0, 0}
end

-- 2. Cleanup expired entries from sliding windows
local global_cutoff = current_ts - global_window
redis.call('ZREMRANGEBYSCORE', global_key, '-inf', global_cutoff)
redis.call('ZREMRANGEBYSCORE', workspace_key, '-inf', global_cutoff)

if platform_limit > 0 and platform_key ~= '' then
  local platform_cutoff = current_ts - platform_window
  redis.call('ZREMRANGEBYSCORE', platform_key, '-inf', platform_cutoff)
end

-- 3. Count current usage
local global_count = redis.call('ZCARD', global_key)
local workspace_count = redis.call('ZCARD', workspace_key)
local platform_count = 0

if platform_limit > 0 and platform_key ~= '' then
  platform_count = redis.call('ZCARD', platform_key)
end

-- 4. Check limits in strict order

-- 4a. Check global budget
if global_count >= global_limit then
  local oldest = redis.call('ZRANGE', global_key, 0, 0, 'WITHSCORES')
  local retry_after = 0
  
  if #oldest >= 2 then
    local oldest_ts = tonumber(oldest[2])
    local base_retry = math.ceil((oldest_ts + global_window - current_ts) / 1000)
    
    -- Apply ±10% jitter (deterministic based on timestamp)
    math.randomseed(current_ts)
    local jitter_factor = 0.9 + (math.random() * 0.2)
    retry_after = math.floor(base_retry * jitter_factor)
    
    -- Cap at window size
    local max_retry = math.ceil(global_window / 1000)
    if retry_after > max_retry then
      retry_after = max_retry
    end
    if retry_after < 1 then
      retry_after = 1
    end
  end
  
  return {0, REASON_GLOBAL_BUDGET, retry_after, global_count, workspace_count, platform_count}
end

-- 4b. Check workspace budget
if workspace_count >= workspace_limit then
  local oldest = redis.call('ZRANGE', workspace_key, 0, 0, 'WITHSCORES')
  local retry_after = 0
  
  if #oldest >= 2 then
    local oldest_ts = tonumber(oldest[2])
    local base_retry = math.ceil((oldest_ts + global_window - current_ts) / 1000)
    
    -- Apply ±10% jitter
    math.randomseed(current_ts)
    local jitter_factor = 0.9 + (math.random() * 0.2)
    retry_after = math.floor(base_retry * jitter_factor)
    
    -- Cap at window size
    local max_retry = math.ceil(global_window / 1000)
    if retry_after > max_retry then
      retry_after = max_retry
    end
    if retry_after < 1 then
      retry_after = 1
    end
  end
  
  return {0, REASON_WORKSPACE_BUDGET, retry_after, global_count, workspace_count, platform_count}
end

-- 4c. Check platform budget (if enabled)
if platform_limit > 0 and platform_key ~= '' and platform_count >= platform_limit then
  local oldest = redis.call('ZRANGE', platform_key, 0, 0, 'WITHSCORES')
  local retry_after = 0
  
  if #oldest >= 2 then
    local oldest_ts = tonumber(oldest[2])
    local base_retry = math.ceil((oldest_ts + platform_window - current_ts) / 1000)
    
    -- Apply ±10% jitter
    math.randomseed(current_ts)
    local jitter_factor = 0.9 + (math.random() * 0.2)
    retry_after = math.floor(base_retry * jitter_factor)
    
    -- Cap at window size
    local max_retry = math.ceil(platform_window / 1000)
    if retry_after > max_retry then
      retry_after = max_retry
    end
    if retry_after < 1 then
      retry_after = 1
    end
  end
  
  return {0, REASON_PLATFORM_BUDGET, retry_after, global_count, workspace_count, platform_count}
end

-- 5. Budget available - increment if requested
if should_increment == 1 then
  redis.call('ZADD', global_key, current_ts, member_id)
  redis.call('ZADD', workspace_key, current_ts, member_id)
  
  -- Set expiration to 2x window size
  local expire_seconds = math.ceil((global_window * 2) / 1000)
  redis.call('EXPIRE', global_key, expire_seconds)
  redis.call('EXPIRE', workspace_key, expire_seconds)
  
  if platform_limit > 0 and platform_key ~= '' then
    redis.call('ZADD', platform_key, current_ts, member_id)
    local platform_expire = math.ceil((platform_window * 2) / 1000)
    redis.call('EXPIRE', platform_key, platform_expire)
  end
  
  -- Update counts after increment
  global_count = global_count + 1
  workspace_count = workspace_count + 1
  if platform_limit > 0 and platform_key ~= '' then
    platform_count = platform_count + 1
  end
end

-- 6. Return admission result
return {1, REASON_ADMITTED, 0, global_count, workspace_count, platform_count}
