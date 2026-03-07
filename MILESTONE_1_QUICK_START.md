# Milestone 1: Quick Start Guide

**Goal**: Get V2 OAuth working in staging  
**Time**: 30 minutes  
**Components**: Backend + Frontend

---

## 🚀 Quick Deploy

### Backend
```bash
cd apps/backend
npm test -- OAuthControllerV2.milestone1.test.ts
npm run deploy:staging
```

### Frontend
```bash
cd apps/frontend
npm run deploy:staging
```

---

## ✅ Quick Test

### 1. Open Page
```
http://staging.yourdomain.com/connect-v2
```

### 2. Connect Twitter
- Click "Connect" for Twitter
- Authorize on Twitter
- See success message

### 3. Check Database
```javascript
db.socialaccounts.findOne({ provider: 'twitter' })
// Should have: connectionVersion: 'v2'
```

---

## 📋 Quick Checklist

- [ ] Backend deployed
- [ ] Frontend deployed
- [ ] Platform list loads
- [ ] OAuth redirect works
- [ ] Success message shows
- [ ] Account in database with `connectionVersion='v2'`

---

## 🔧 Quick Fixes

### Platform list doesn't load
```bash
# Check VITE_API_URL
echo $VITE_API_URL
# Should be: http://localhost:5000/api/v1
```

### OAuth redirect fails
```bash
# Check backend logs
tail -f logs/backend.log | grep "\[V2\]"
```

### Success but no account
```bash
# Check MongoDB connection
mongo --eval "db.socialaccounts.find().count()"
```

---

## 📊 Quick Verify

### Backend Health
```bash
curl http://staging.yourdomain.com/api/v1/oauth-v2/platforms
# Should return: {"success":true,"platforms":["twitter","linkedin","facebook","instagram"]}
```

### Frontend Health
```bash
curl http://staging.yourdomain.com/connect-v2
# Should return: HTML page
```

### Database Health
```javascript
db.socialaccounts.find({ connectionVersion: 'v2' }).count()
// Should return: number of V2 accounts
```

---

## 🎯 Success = All Green

- ✅ Backend responds to `/oauth-v2/platforms`
- ✅ Frontend loads `/connect-v2`
- ✅ OAuth flow completes
- ✅ Account created with `connectionVersion='v2'`
- ✅ No errors in logs

---

## 📚 Full Docs

- **Backend**: `MILESTONE_1_IMPLEMENTATION_SUMMARY.md`
- **Frontend**: `MILESTONE_1_FRONTEND_IMPLEMENTATION.md`
- **Testing**: `MILESTONE_1_TESTING_GUIDE.md`
- **Complete**: `MILESTONE_1_COMPLETE.md`

---

**Time to Deploy**: 30 minutes  
**Time to Test**: 5 minutes  
**Total**: 35 minutes

🚀 **Ready to go!**
