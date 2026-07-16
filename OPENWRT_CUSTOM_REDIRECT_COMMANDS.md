# HOTEL OA custom captive portal redirect

This guide keeps the main project safe. It only uses files from:

```txt
level-2-openwrt-experiment/openwrt-captive-portal
```

## 1. Upload custom portal files to OpenWrt

From Windows PowerShell:

```powershell
scp "C:\Users\ftnay\OneDrive\Documents\SEM 6\PROJECT FYP\level-2-openwrt-experiment\openwrt-captive-portal\index.html" root@192.168.167.2:/tmp/index.html
scp "C:\Users\ftnay\OneDrive\Documents\SEM 6\PROJECT FYP\level-2-openwrt-experiment\openwrt-captive-portal\style.css" root@192.168.167.2:/tmp/style.css
scp "C:\Users\ftnay\OneDrive\Documents\SEM 6\PROJECT FYP\level-2-openwrt-experiment\openwrt-captive-portal\script.js" root@192.168.167.2:/tmp/script.js
scp "C:\Users\ftnay\OneDrive\Documents\SEM 6\PROJECT FYP\level-2-openwrt-experiment\openwrt-captive-portal\config.js" root@192.168.167.2:/tmp/config.js
```

If `scp` asks password, use the same OpenWrt root password used for LuCI.

## 2. Move files into OpenWrt web folder

In OpenWrt VM console:

```sh
mkdir -p /www/hotel-oa
mv /tmp/index.html /www/hotel-oa/index.html
mv /tmp/style.css /www/hotel-oa/style.css
mv /tmp/script.js /www/hotel-oa/script.js
mv /tmp/config.js /www/hotel-oa/config.js
/etc/init.d/uhttpd restart
```

Check from phone connected to HOTEL OA:

```txt
http://192.168.50.1/hotel-oa/
```

## 3. Configure openNDS to redirect to the custom portal

In OpenWrt VM console:

```sh
uci set opennds.@opennds[0].gatewayinterface='phy0-ap0'
uci set opennds.@opennds[0].gatewayname='HOTEL_OA_CAPTIVE_PORTAL'
uci set opennds.@opennds[0].fas_secure_enabled='0'
uci set opennds.@opennds[0].fasremoteip='192.168.50.1'
uci set opennds.@opennds[0].fasport='80'
uci set opennds.@opennds[0].faspath='/hotel-oa/index.html'
uci add_list opennds.@opennds[0].walledgarden_fqdn_list='hotel-oa-backend.onrender.com'
uci commit opennds
/etc/init.d/opennds restart
```

## 4. Clear old phone captive portal session

In OpenWrt VM console:

```sh
ndsctl deauth all
```

On the phone:

```txt
Forget HOTEL OA
Reconnect HOTEL OA
```

## 5. Expected test result

```txt
Phone connects to HOTEL OA
↓
iPhone captive popup appears
↓
Custom HOTEL OA portal is shown
↓
Guest enters room number + WiFi password
↓
Backend creates active session
↓
Dashboard Connected Users shows the device
↓
openNDS allows Internet
```

## If it does not redirect

Check openNDS status:

```sh
ndsctl status
logread | grep -i opennds
```

Check if custom portal is reachable:

```sh
wget -O- http://192.168.50.1/hotel-oa/
```

