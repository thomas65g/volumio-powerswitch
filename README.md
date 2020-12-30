# volumio-powerswitch
When Volumio started streaming, two relay are switched ON and after streaming has stopped or paused are switched OFF

Two amplifiers should only be switched on when they are needed.
The switching sequence looks like this:
start: port A ON  (pause of 500ms) port B ON
pause | stop: delay of 10000ms port B OFF  (pause of 500ms) port A OFF

BOM (as an example):
Raspberry Pi Shield - HiFiBerry DAC+ pro 
Raspberry Pi 3 A+, 4x 1,4 GHz, 512 MB RAM, WLAN, BT
Entwicklerboards - Relais-Modul, 2 Channel, 5 V, SRD-05VDC-SL-C
Profilgehäuse, 1455 T, 220 x 165 x 51,5 mm, schwarz 
Kaltgerätestecker mit Sicherungseinsatz, Snap-In 
Kaltgerätebuchse Snap-in-Vorn, 2-fach
CAT 6a Verlängerungskabel, S/FTP (PiMF), Schwarz, 0,5 m 
Power Supply 5V/1A (Reused)
Schaltdraht 0.8mm und 1mm
Abgeschirmtes Audiokabel 0.5m
Veroboard 160x100 2xmal
Chinch Buchsen (Grabbelkiste)

# installation
open ssh on rasperry volumio (PC)
mkdir powerswitch (RASPI)
cd powerswitch (RASPI)
copy repo to powerswitch (filezilla) (PC)
npm install (RASPI)
volumio plugin install (RASPI)
finalize installation in Volumio UI (PC)