# OpenWrt Stable Setup Notes

These notes document the stable OpenWrt VM setup used for the HOTEL OA captive
portal experiment.

## Stable Interface Mapping

| OpenWrt Interface | VMware Adapter | Role | Expected Status |
| --- | --- | --- | --- |
| `eth0` | Network Adapter 1 | WAN / Internet via VMware NAT | UP, DHCP client |
| `eth1` | Network Adapter 2 | LAN / LuCI / captive portal side | UP, static IP |

## Stable IP Configuration

| Item | Value |
| --- | --- |
| OpenWrt LAN IP | `192.168.167.2` |
| Windows VMnet1 IP | `192.168.167.1` |
| LuCI URL | `http://192.168.167.2/cgi-bin/luci/` |
| WAN device | `eth0` |
| LAN device | `eth1` |

## Restore Stable Network Configuration

Run these commands in the OpenWrt console if the network configuration becomes
unstable:

```sh
uci set network.wan.device='eth0'
uci set network.wan.proto='dhcp'

uci set network.lan.device='eth1'
uci set network.lan.proto='static'
uci set network.lan.ipaddr='192.168.167.2'
uci set network.lan.netmask='255.255.255.0'

uci commit network
/etc/init.d/network restart
```

Then force `eth0` up if needed:

```sh
ip link set eth0 up
udhcpc -i eth0
```

Check internet:

```sh
ip addr show eth0
ping 8.8.8.8
```

If ping works, OpenWrt WAN is working.

## LuCI Access Fix

If LuCI shows:

```txt
Error 403 - Forbidden - Access Denied to this Client
```

disable openNDS temporarily:

```sh
/etc/init.d/opennds stop
/etc/init.d/opennds disable
/etc/init.d/uhttpd restart
/etc/init.d/firewall restart
```

If LuCI still blocks access:

```sh
uci set uhttpd.main.rfc1918_filter='0'
uci commit uhttpd
/etc/init.d/uhttpd restart
```

## openNDS Status

For normal LuCI configuration work, keep openNDS disabled:

```sh
/etc/init.d/opennds stop
/etc/init.d/opennds disable
```

When ready to test captive portal again:

```sh
/etc/init.d/opennds enable
/etc/init.d/opennds start
ndsctl status
```

## Tenda Test Result

The Tenda mobile WiFi was detected by VMware and OpenWrt as a USB network
device.

Observed result:

```txt
lsusb: ZTE WCDMA Technologies MSM Tenda Mobile Wi-Fi
ip link: eth2 detected
```

Conclusion:

```txt
The Tenda device is partially compatible because OpenWrt can detect it as eth2.
However, it was not kept as the main WAN because DHCP/internet assignment was
not stable during testing.
```

Recommended current state:

```txt
Tenda = normal internet device / backup
OpenWrt WAN = eth0 through VMware NAT
OpenWrt LAN = eth1 for future guest AP/captive portal side
```

## Future Hardware Flow

Recommended architecture when AP or dongle is available:

```txt
Internet / Laptop / Tenda
        ↓
OpenWrt VM eth0 = WAN
        ↓
OpenWrt routing + captive portal
        ↓
OpenWrt eth1 = LAN
        ↓
AP or USB WiFi dongle
        ↓
SSID: HOTEL OA
        ↓
Guest phone
```

Important rule:

```txt
Guest device must receive OpenWrt as its gateway.
```

Example guest network:

```txt
Guest IP: 192.168.10.x
Gateway: OpenWrt LAN IP
```

If the guest gateway is Tenda, the guest bypasses OpenWrt and the captive portal
will not control the connection properly.
