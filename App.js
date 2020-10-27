import React from 'react';
import {RNCamera} from 'react-native-camera';
import {
  Platform,
  TouchableOpacity,
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  Modal,
} from 'react-native';
import {requestMultiple, PERMISSIONS} from 'react-native-permissions';
import storage from '@react-native-firebase/storage';
import Video from 'react-native-video';
import RNFetchBlob from 'rn-fetch-blob';

import RNVideoHelper from 'react-native-video-helper';

const reference = storage().ref('video');

export default class App extends React.Component {
  cam = null;
  constructor(props) {
    super(props);
    this.state = {
      downloadingFile: false,
      downloadingFileError: false,
      localPath: null,
      loading: false,
      modalVisibility: false,
      progress: null,
      uploadState: '',
      video: null,
      recording: false,
      cameraPermission: false,
      microphonePermission: false,
    };
  }

  componentDidMount = async () => {
    this.askPermission();
    this.checkIfExist();
  };

  downloadFile = (url) => {
    this.setState({
      downloadingFile: true,
      downloadingFileError: false,
    });
    RNFetchBlob.config({
      fileCache: true,
    })
      .fetch('GET', url)
      .then((res) => {
        this.setState({
          downloadingFile: false,
          downloadingFileError: false,
        });
        this.setState({localPath: res.path()});
      })
      .catch(() => {
        this.setState({
          downloadingFile: false,
          downloadingFileError: true,
        });
        this.setState({localPath: null});
      });
  };

  checkIfExist = async () => {
    try {
      const url = await storage().ref('video').getDownloadURL();
      this.downloadFile(url);
    } catch (e) {
      this.setState({localPath: null});
    }
  };

  askPermission = () => {
    if (Platform.OS === 'ios') {
      requestMultiple([PERMISSIONS.IOS.CAMERA, PERMISSIONS.IOS.MICROPHONE]);
    } else {
      requestMultiple([PERMISSIONS.ANDROID.CAMERA]).then((r) => {
        requestMultiple([
          PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE,
          PERMISSIONS.ANDROID.WRITE_EXTERNAL_STORAGE,
        ]);
      });
    }
  };

  startRecording = () => {
    if (this.state.recording) {
      return;
    }

    this.setState({recording: true});
    this.cam
      .recordAsync({
        // quality: 0.5
      })
      .then((data) => {
        this.setState({video: data}, () => {
          this.uploadFile();
        });
      })
      .catch((err) => console.log(err));
  };

  uploadFile = async () => {
    this.setState({uploadState: 'running'});
    RNVideoHelper.compress(this.state.video.uri, {
      quality: 'low', // default low, can be medium or high
    }).then((compressedUri) => {
      const task = reference.putFile(compressedUri);
      task.on('state_changed', (taskSnapshot) => {
        if (taskSnapshot.state === 'success') {
          setTimeout(() => {
            this.checkIfExist();
          }, 2000);
        }

        this.setState({
          uploadState: taskSnapshot.state,
          progress:
            (taskSnapshot.bytesTransferred / taskSnapshot.totalBytes).toFixed(
              2,
            ) * 100,
        });
      });
    });

    // To test compression uncomment the below code and check the size after 10 seconds in firebase
    // setTimeout(() => {
    //   const task = reference.putFile(this.state.video.uri);
    //   task.on('state_changed', (taskSnapshot) => {
    //     if (taskSnapshot.state === 'success') {
    //       setTimeout(() => {
    //         this.checkIfExist();
    //       }, 2000);
    //     }

    //     this.setState({
    //       uploadState: taskSnapshot.state,
    //       progress:
    //         (taskSnapshot.bytesTransferred / taskSnapshot.totalBytes).toFixed(
    //           2,
    //         ) * 100,
    //     });
    //   });
    // }, 10000);
  };

  stopRecording = () => {
    this.cam.stopRecording();
    this.setState({recording: false});
  };

  _renderDownloading = () => {
    return (
      <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
        <Text>Downloading...</Text>
      </View>
    );
  };

  _renderDownloadingError = () => {
    return (
      <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
        <Text>Something went wrong</Text>
      </View>
    );
  };

  _renderUpload = () => {
    return (
      <View
        style={{
          flex: 1,
          zIndex: 99999,
          position: 'absolute',
          backgroundColor: '#DDDDDD30',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          justifyContent: 'center',
          alignItems: 'center',
        }}>
        <View
          style={{
            position: 'absolute',
            zIndex: 9,
            height: 200,
            width: 200,
            backgroundColor: '#000000',
            justifyContent: 'center',
            alignItems: 'center',
          }}>
          <ActivityIndicator color="#FFFFFF" />
          <Text
            style={{
              color: '#FFFFFF',
            }}>
            {this.state.progress ? this.state.progress : '0'} %
          </Text>
        </View>
      </View>
    );
  };

  _renderModal = () => {
    const {localPath, downloadingFile, downloadingFileError} = this.state;
    return (
      <Modal
        visible={this.state.modalVisibility}
        onRequestClose={() => this.setState({modalVisibility: false})}>
        <View
          style={{
            flex: 1,
          }}>
          {downloadingFile ? (
            this._renderDownloading()
          ) : downloadingFileError ? (
            this._renderDownloadingError()
          ) : localPath ? (
            <Video
              controls
              source={{uri: this.link}}
              source={{
                uri: localPath ? localPath : '',
              }}
              ref={(ref) => {
                this.player = ref;
              }}
              style={styles.backgroundVideo}
            />
          ) : null}
          <TouchableOpacity
            style={{
              position: 'absolute',
              bottom: 0,
              height: 100,
              width: '100%',
              backgroundColor: '#FFFFFF',
              justifyContent: 'center',
              alignItems: 'center',
            }}
            onPress={() => {
              this.setState({modalVisibility: false});
            }}>
            <Text>CLOSE</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  };

  render() {
    const {recording, uploadState, localPath} = this.state;
    return (
      <View style={{flex: 1}}>
        <RNCamera
          captureMode="video"
          ref={(cam) => (this.cam = cam)}
          style={{flex: 1}}
        />
        <TouchableOpacity
          style={{
            height: 100,
            width: '100%',
            backgroundColor: '#FFFFFF',
            justifyContent: 'center',
            alignItems: 'center',
          }}
          onPress={recording ? this.stopRecording : this.startRecording}>
          <Text>{recording ? 'STOP' : 'START'}</Text>
        </TouchableOpacity>
        {localPath ? (
          <TouchableOpacity
            style={{
              height: 100,
              width: '100%',
              backgroundColor: '#FFFFFF',
              justifyContent: 'center',
              alignItems: 'center',
            }}
            onPress={() => {
              this.setState({modalVisibility: true});
            }}>
            <Text>SHOW</Text>
          </TouchableOpacity>
        ) : null}
        {this.state.uploadState === 'running' ? this._renderUpload() : null}
        {this._renderModal()}
      </View>
    );
  }
}

// Later on in your styles..
var styles = StyleSheet.create({
  backgroundVideo: {
    position: 'absolute',
    top: 200,
    left: 0,
    bottom: 0,
    right: 0,
  },
});
