const fetch = require('node-fetch');
import { StationInfoPacket } from './station-info';
import { GpsPacket } from './gps';
import { SensorPacket } from './sensor';
import { HardwarePacket } from './hardware';
import { ModemPacket } from './modem';

class QaqcReport {
  constructor(opts) {
    this.station_id = opts.station_id;
    this.hardware_server_url = 'http://localhost:3000';
    this.urls = {
      modem: this.hardware_server_url + '/modem',
      gps: this.hardware_server_url + '/gps',
      sensor: this.hardware_server_url + '/sensor/details',
      hardware:  this.hardware_server_url + '/peripherals'
    }
  }

  /**
   * poll hardware server for qaqc data to send
   */
  getResults() {
    return new Promise((resolve, reject) => {
      let promises = [];
      let keys = [], url;
      Object.keys(this.urls).forEach((key) => {
        url = this.urls[key];
        keys.push(key);
        promises.push(fetch(url).then(res => res.json()).catch((err) => {
          console.error('error fetching data', key);
          console.error(err);
          return null;
        }));
      });
      Promise.all(promises).then((results) => {
        let data = {};
        let key;
        results.forEach((result, i) => {
          key = keys[i];
          data[key] = results[i];
        });
        return data;
      }).then((data) => {
        resolve(data);
      }).catch((err) => {
        console.error('error polling qaqc results');
        console.error(err);
        reject(err);
      });
    });
  }

  getGpsData(gps_results) {
    let lat = 0;
    let lng = 0;
    let nsats = 0;
    let mode = 0;
    let gps_time = 0;
    if (gps_results.gps) {
      lat = gps_results.gps.lat;
      lng = gps_results.gps.lon;
      gps_time = gps_results.gps.time;
      mode = gps_results.gps.mode;
    }
    if (gps_results.sky) {
      nsats = gps_results.sky.satellites.reduce((prev, current) => {
        if (current.used) {
          return prev += 1;
        }
        return prev;
      }, 0);
      console.log('NSATS', nsats);
    }
    return {
      lat: lat,
      lng: lng,
      nsats: nsats,
      mode: mode,
      gps_time: gps_time
    }
  }

  getInfo(modem) {
    return {
      sim: modem.sim ? modem.sim : 0,
      imei: modem.imei ? modem.imei: 0
    }
  }

  getSensorInfo(sensor) {
    let battery = 0;
    let solar = 0;
    let rtc = 0;
    let temp_c = 0;
    if (sensor.voltages) {
      battery = parseFloat(sensor.voltages.battery);
      solar = parseFloat(sensor.voltages.solar);
      rtc = parseFloat(sensor.voltages.rtc);
    }
    if (sensor.temperature) {
      temp_c = parseInt(sensor.temperature.celsius)
    }
    return {
      battery: battery,
      solar: solar,
      rtc: rtc,
      temp_c: temp_c
    }
  }

  getHardwareInfo(hardware) {
    let now = new Date();
    let usb_hub_count = 0;
    let radio_count = 0;
    hardware.info.forEach((component) => {
      if (component.vendor == '239a') {
        if (component.product == '800c') {
          radio_count += 1;
        }
      }

      if (component.vendor == '0424') {
        if (component.vendor == '2514') {
          usb_hub_count += 1;
        }
      }
    });

    return {
      usb_hub_count: usb_hub_count,
      radio_count: radio_count,
      system_time: now.getTime()
    }
  }

  getModemInfo(modem) {
    console.log('getting modem info', modem);
    let signal = 0;
    let carrier = '';
    let network = '';
    if (modem.carrier) {
      let values = modem.carrier.split(',');
      if (values.length == 2) {
        carrier = values[0].trim();
        network = values[1].trim();
      } else {
        carrier = modem.carrier;
      }
    }
    return {
      signal: signal,
      carrier: carrier,
      network: network
    }
  }

  generatePackets(results) {
    let gps = this.getGpsData(results.gps);
    let gps_packet = new GpsPacket({
      station_id: this.station_id,
      lat: gps.lat,
      lng: gps.lng,
      nsats: gps.nsats,
      mode: gps.mode,
      gps_time: gps.gps_time
    });

    let info = this.getInfo(results.modem);
    let info_packet = new StationInfoPacket({
      station_id: this.station_id,
      sim: info.sim,
      imei: info.imei
    });

    let sensor = this.getSensorInfo(results.sensor);
    console.log('SENSOR', sensor)
    let sensor_packet = new SensorPacket({
      station_id: this.station_id,
      battery: sensor.battery,
      solar: sensor.solar,
      rtc: sensor.rtc,
      temp_c: sensor.temp_c
    });

    let hardware = this.getHardwareInfo(results.hardware);
    console.log('hardware', hardware)
    let hardware_packet = new HardwarePacket({
      station_id: this.station_id,
      usb_hub_count: hardware.usb_hub_count,
      radio_count: hardware.radio_count,
      system_time: hardware.system_time
    });

    let modem = this.getModemInfo(results.modem);
    console.log('modem', modem);
    let modem_packet = new ModemPacket({
      station_id: this.station_id,
      signal: modem.signal,
      carrier: modem.carrier,
      network: modem.network
    });

    return {
      info: info_packet,
      gps: gps_packet,
      sensor: sensor_packet,
      hardware: hardware_packet,
      modem: modem_packet
    }
  }
}

export { QaqcReport };