#ifndef __ZBT_Z8102AX_V2_H
#define __ZBT_Z8102AX_V2_H

#include "mt7981.h"

#define CONFIG_BOARD_MODEL "ZBT Z8102AX V2"

#undef CONFIG_EXTRA_ENV_SETTINGS
#define CONFIG_EXTRA_ENV_SETTINGS \
    "dhcp_server_ip=192.168.1.1\0" \
    "dhcp_netmask=255.255.255.0\0" \
    "dhcp_start=192.168.1.100\0" \
    "dhcp_end=192.168.1.200\0" \
    "serverip=192.168.1.254\0" \
    "ipaddr=192.168.1.1\0" \
    "netmask=255.255.255.0\0" \
    "bootmenu_delay=3\0"

#endif
