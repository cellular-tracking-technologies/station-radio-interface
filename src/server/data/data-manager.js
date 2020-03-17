import { FileManager } from './file-manager';
import { Logger } from './logger';
import { BeepFormatter } from './beep-formatter';
import { GpsFormatter } from './gps-formatter';
import { NodeHealthFormatter } from './node-health-formatter';
/**
 * manager class for incoming beep packets
 */
class DataManager {
  /**
   * 
   * @param {*} opts 
   */
  constructor(opts) {
    this.id = opts.id;
    this.base_log_dir = opts.base_log_dir;
    this.date_format = opts.date_format;

    // utility for maintaining filenames for given id, descriptor (suffix)
    this.file_manager = new FileManager({
      id: this.id,
      base_log_dir: this.base_log_dir
    });

    // loggers for each data file
    this.loggers = {
      beep: new Logger({
        fileuri: this.file_manager.getFileUri('raw-data'),
        suffix: 'raw-data',
        formatter: new BeepFormatter({
          date_format: this.date_format
        }),
      }),
      gps: new Logger({
        fileuri: this.file_manager.getFileUri('gps'),
        suffix: 'gps',
        formatter: new GpsFormatter({
          date_format: this.date_format
        })
      }),
      node_health: new Logger({
        fileuri: this.file_manager.getFileUri('node-health'),
        suffix: 'node-health',
        formatter: new NodeHealthFormatter({
          date_format: this.date_format
        })
      })
    }
  }

  /**
   * write all the loggers cache to disk
   */
  writeCache() {
    Object.keys(this.loggers).forEach((key) => {
      let logger = this.loggers[key];
      logger.writeCacheToDisk();
    });
  }

  /**
   * 
   * @param {*} beep 
   */
  handleRadioBeep(beep) {
    if (beep.meta) {
      // expect new protocol
      switch (beep.meta.data_type) {
        case 'coded_id': {
          this.loggers.beep.addRecord(beep);
          break;
        }
        case 'node_coded_id': {
          this.loggers.beep.addRecord(beep);
          break;
        }
        case 'node_health': {
          this.loggers.node_health.addRecord(beep);
          break;
        }
        default: {
          console.error(`i don't know what to do with this record ${beep}`);
          break;
        }
      }
    } else {
      // handle original protocol
      if (beep.data.node_alive) {
        this.loggers.node_health.addRecord(beep);
        return;
      }
      if (beep.data.node_beep) {
        this.loggers.beep.addRecord(beep);
        return;
      }
      if (beep.data.tag) {
        this.loggers.beep.addRecord(beep);
        return;
      };
      console.error('uknown record here', beep);
    }
  }

  /**
   * 
   * @param {*} record - GPS record
   */
  handleGps(record) {
    this.loggers.gps.addRecord(record);
  }

  /**
   * rotate all logging files
   */
  rotate() {
    // reduce the array of loggers by rotating data files one at a time
    return Object.keys(this.loggers).reduce((previousPromise, nextLoggerKey) => {
      let logger = this.loggers[nextLoggerKey];
      return previousPromise.then((rotateResult) => {
        // after prior promise - return the next promise to execute
        return this.file_manager.rotateDataFile({
          fileuri: logger.fileuri,
          new_basename: this.file_manager.getFileName(logger.suffix)
        }).catch((err) => {
          console.error(`problem rotating file ${logger.fileuri}`);
          console.error(err);
        });
      })
    }, Promise.resolve());
  }
}

export { DataManager };