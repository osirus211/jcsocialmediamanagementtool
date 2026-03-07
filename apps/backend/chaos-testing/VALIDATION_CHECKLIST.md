# Chaos Testing Validation Checklist

## Pre-Test Checklist

- [ ] Docker and Docker Compose installed
- [ ] At least 8GB RAM available
- [ ] At least 20GB disk space available
- [ ] No other services using ports 3000, 6379, 27017, 9090
- [ ] Configuration reviewed and adjusted if needed
- [ ] Reports directory exists and is writable

## Test Execution Checklist

- [ ] Infrastructure starts successfully (MongoDB, Redis)
- [ ] API starts and responds to health checks
- [ ] Workers start successfully
- [ ] Metrics exporter starts and exposes metrics
- [ ] Load simulator starts and creates workspaces/accounts
- [ ] Posts are scheduled successfully
- [ ] Publishing begins
- [ ] Chaos injection occurs (if enabled)
- [ ] Metrics are collected throughout test
- [ ] Test completes without crashing

## Validation Checklist

### Critical Validations (Must Pass)

- [ ] **No Duplicate Publishes**: Zero posts published more than once
- [ ] **No Refresh Storm**: Peak refresh rate ≤ threshold
- [ ] **No Concurrent Refresh**: Zero concurrent refresh violations
- [ ] **No Retry Storm**: Zero retry storm events
- [ ] **No Job Explosion**: Queue size growth stays bounded
- [ ] **No Memory Runaway**: Memory growth ≤ 2x baseline
- [ ] **No Queue Starvation**: Queue lag ≤ 60 seconds

### Performance Validations (Should Pass)

- [ ] Publish success rate ≥ 95%
- [ ] Average queue lag < 5 seconds
- [ ] Worker uptime > 90% of test duration
- [ ] Redis connection stable throughout test
- [ ] MongoDB connection stable throughout test

### Chaos Validations (If Enabled)

- [ ] Workers recover after crashes
- [ ] System recovers after Redis restart
- [ ] Circuit breakers open on rate limits
- [ ] Backoff works correctly
- [ ] Token refresh handles corruption
- [ ] Token refresh handles revocation
- [ ] Platform errors handled gracefully

## Post-Test Checklist

- [ ] Reports generated successfully
- [ ] JSON report is valid JSON
- [ ] Markdown report is readable
- [ ] Summary shows clear pass/fail
- [ ] Logs contain no unexpected errors
- [ ] All validation checks documented
- [ ] Failed checks (if any) investigated
- [ ] Cleanup completed successfully

## Report Review Checklist

### Metadata

- [ ] Test name is correct
- [ ] Timestamp is accurate
- [ ] Duration matches expected
- [ ] Environment info is complete

### Configuration

- [ ] Load configuration matches what was set
- [ ] Chaos configuration matches what was set
- [ ] Thresholds are appropriate

### Execution Summary

- [ ] Workspaces created matches expected
- [ ] Accounts created matches expected
- [ ] Posts scheduled matches expected
- [ ] Success rate is acceptable

### Metrics

- [ ] Duplicate detection metrics present
- [ ] Refresh storm metrics present
- [ ] Rate limit metrics present
- [ ] Memory metrics present
- [ ] All metrics have reasonable values

### Validation Results

- [ ] All critical checks listed
- [ ] Pass/fail status clear for each check
- [ ] Thresholds documented
- [ ] Actual values documented

### Conclusion

- [ ] Overall result is clear (PASSED/FAILED)
- [ ] Summary explains result
- [ ] Failed checks (if any) are listed
- [ ] Recommendations provided (if failed)

## Troubleshooting Checklist

If test fails, check:

- [ ] Docker logs for errors
- [ ] MongoDB logs for connection issues
- [ ] Redis logs for connection issues
- [ ] Worker logs for crashes
- [ ] API logs for errors
- [ ] Metrics for anomalies
- [ ] System resources (CPU, memory, disk)
- [ ] Network connectivity
- [ ] Configuration values
- [ ] Chaos injection rates (may be too high)

## Retest Checklist

After fixing issues:

- [ ] Root cause identified
- [ ] Fix implemented
- [ ] Configuration adjusted if needed
- [ ] Cleanup completed
- [ ] Test re-run
- [ ] Results compared to previous run
- [ ] Improvement verified

## Sign-Off Checklist

- [ ] All critical validations passed
- [ ] Performance is acceptable
- [ ] Chaos handling is robust
- [ ] Reports are complete
- [ ] Issues documented
- [ ] System ready for production

---

## Test Results

**Date**: _______________

**Tester**: _______________

**Result**: [ ] PASSED  [ ] FAILED

**Notes**:
_______________________________________________
_______________________________________________
_______________________________________________

**Sign-off**: _______________
