# HOTEL OA Public Captive Portal Setup

This setup is for the OpenWrt architecture where:

```txt
Phone / Guest
  ↓
HOTEL OA WiFi from OpenWrt
  ↓
openNDS captive portal
  ↓
Public HOTEL OA custom portal
  ↓
Backend API on Render
  ↓
Dashboard
```

The purpose is to avoid local `192.168.50.1:2080` browser issues on iPhone captive portal.

## 1. Deploy this folder as a public static website

Deploy this folder:

```txt
level-2-openwrt-experiment/openwrt-captive-portal
```

Recommended Render settings:

```txt
Service type: Static Site
Root Directory: level-2-openwrt-experiment/openwrt-captive-portal
Build Command: leave empty
Publish Directory: .
```

After deployment, Render will give a URL like:

```txt
https://hotel-oa-captive-portal.onrender.com
```

Open the URL in a normal browser first. The page should show:

```txt
HOTEL OA
Guest WiFi Access
Room Number
WiFi Password
Connect to WiFi
```

## 2. Confirm backend URL

The portal currently calls:

```txt
https://hotel-oa-backend.onrender.com/api/login
https://hotel-oa-backend.onrender.com/api/request-device
```

This is configured in:

```txt
config.js
```

If the backend URL changes, update:

```js
backendBaseUrl: 'https://hotel-oa-backend.onrender.com'
```

## 3. Configure OpenWrt openNDS to allow the public portal

Replace this domain:

```txt
hotel-oa-captive-portal.onrender.com
```

with the actual Render URL domain.

Run on OpenWrt:

```sh
uci add_list opennds.@opennds[0].walledgarden_fqdn_list='hotel-oa-captive-portal.onrender.com'
uci add_list opennds.@opennds[0].walledgarden_fqdn_list='hotel-oa-backend.onrender.com'
uci commit opennds
/etc/init.d/opennds restart
```

## 4. Test public portal manually from phone

Connect phone to:

```txt
HOTEL OA
```

Close the default captive popup if it appears.

Open Safari/Chrome and go to the public portal URL:

```txt
https://hotel-oa-captive-portal.onrender.com
```

The custom portal should load.

## 5. Redirect openNDS to the public portal

Only do this after Step 4 works.

Run on OpenWrt:

```sh
uci set opennds.@opennds[0].fas_secure_enabled='0'
uci set opennds.@opennds[0].fasremoteip='hotel-oa-captive-portal.onrender.com'
uci set opennds.@opennds[0].fasport='443'
uci set opennds.@opennds[0].faspath='/'
uci commit opennds
/etc/init.d/opennds restart
```

Then clear old captive sessions:

```sh
ndsctl deauth all
```

On phone:

```txt
Forget HOTEL OA
Reconnect HOTEL OA
Open http://neverssl.com
```

Expected:

```txt
openNDS redirects to HOTEL OA custom portal
Guest enters room + password
Backend verifies access
Guest presses Continue to Internet
openNDS authenticates the device
Internet access is allowed
```

## 6. If openNDS says `uci: Invalid argument`

Rollback the FAS settings:

```sh
uci delete opennds.@opennds[0].fas_secure_enabled
uci delete opennds.@opennds[0].fasremoteip
uci delete opennds.@opennds[0].fasport
uci delete opennds.@opennds[0].faspath
uci commit opennds
/etc/init.d/opennds restart
```

Then confirm default openNDS works:

```sh
ndsctl status
```

## 7. FYP explanation

For the report/viva:

```txt
The OpenWrt gateway provides the hotel WiFi SSID and captive portal enforcement.
The custom hotel portal is hosted as a public static web application to ensure
stable access from mobile captive browsers. The portal communicates with the
backend API to verify room credentials, enforce per-room device limits, and
create additional device requests for staff approval.
```
