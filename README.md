# PedalHF -- Control an HF Radio Simply Using Your Phone

I'm starting to use my bicycle again, and I have an [FT--818](https://www.yaesu.com/indexVS.cfm?cmd=DisplayProducts&ProdCatID=102&encProdID=36B7B98621AF7554C9A03C8B190C5079).      I want to operate bicycle mobile on 20m.  

I have an ammo box with the radio, a battery, a raspberry pi, with an antenna sticking out of it.   This runs on my raspberry pi, which is acting as a hot spot.

I also have an android phone at my handlebars so I have navigation and whatnot.  I go to a web page on my phone, and I can control my radio as well.   All is good.

## Requirements

 * [hamlib](https://hamlib.github.io/)
 * A web server that can proxy a TCP port over websockets.  I use [lighttpd](https://www.lighttpd.net/).
 * What little configuration is in here assumes Arch Linux.   It would be trivial to adapt this to other distributions.
 
## Setup

 * copy ``etc/rigctld.conf`` to /etc, edit as necessary.
 * copy ``etc/rigctld.service`` to /etc/systemd/system, daemon-reload, start and check the service.
 * incorporate the changes in ``etc/lighttpd.example`` into your lighttpd configuration
 * copy the html and css files, plus the js and font dirs somewhere useful in your webroot.
 * Run the ``get_fonts.sh`` script to get the right fonts.  It will probably fail, check the source for details.
 
At that point, point to where you put it.  Since hamlib is exposed as a websocket, nothing like node or php is required.

## Security?

The security here is that I'm operating in the middle of nowhere.   Security by geolocational obscurity.   It runs an a *Bicycle Area Network*, not on the wide internet.

## Credit

I adapted the ``rigctld`` systemd system from [this issue](https://github.com/la5nta/pat/issues/221) for the pat winlink system.

