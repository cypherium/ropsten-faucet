import React, { Component } from 'react';
import NotificationSystem from 'react-notification-system';
import ReCAPTCHA from 'react-google-recaptcha';
import axios from 'axios';

import './App.css';

class App extends Component {
  constructor() {
    super();
    this.state = {
      'address': '',
    };
    this.notificationSystem = null;

    this.addNotification = this.addNotification.bind(this);
    // this.handleCaptchaResponse = this.handleCaptchaResponse.bind(this);
    this.handleChange = this.handleChange.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
  }

  componentDidMount() {
    this.notificationSystem = this.refs.notificationSystem;
  }

  addNotification(type, response) {
    let action;
    if (type === 'success') {
      action = {
        label: 'View Transaction',
        callback: function() {
          window.open('https://explorerropsten.cypherium.io/tx/' + response);
        }
      }
    }
    switch(type) {
      case 'success':
        this.notificationSystem.addNotification({
          message: 'Transaction Successful!',
          level: type,
          position: 'bc',
          action: action
        });
        break;
      case 'error':
        if (response === 'IP address temporarily blacklisted.') {
          this.notificationSystem.addNotification({
            message: "We only drip 5 CPH per user per day, please try again tomorrow.",
            level: type,
            position: 'bc'
          });
        } else if (response === 'Invalid Recaptcha.') {
          this.notificationSystem.addNotification({
            message: "Invalid recaptcha response, try again.",
            level: type,
            position: 'bc'
          });
        } else if (response === 'Empty address field.'){
          this.notificationSystem.addNotification({
            message: "Address field cannot be empty.",
            level: type,
            position: 'bc'
          })
        } else {
          this.notificationSystem.addNotification({
            message: 'Transaction Unsuccessful!',
            level: type,
            position: 'bc'
          });
        }
        break;
      default:
        break;
    }
  }

  handleChange(e) {
    this.setState({ 'address': e.target.value});
  }

  async handleSubmit(e) {
    e.preventDefault();
    // window.grecaptcha.reset();
    let address = this.state.address;
    // let recaptcha = this.state.recaptcha;
    const url = 'https://pubnodetest.cypherium.io/api/eth_sendRawTransaction';

    let type = '';
    let response;
    let txHash = '';
    let post_error = false;

    try {
      response = await axios({
        method: 'POST',
        url: url,
        headers: {
          'Content-Type': 'application/json'
        },
        data: JSON.stringify({
          'address': address,
        })
      })
    } catch(e) {
      post_error = true;
      type = 'error';
      txHash = e.response.data;
    }

    if (!post_error) {
      if (response['data']) {
        type = 'success';
        txHash = response.data;
      }
    }

    this.addNotification(type, txHash);

    this.setState({ 'address': ''});
  }

  // handleCaptchaResponse(response) {
  //   this.setState({ 'recaptcha': response })
  // }

  render() {
    return (
        <div>
          <div className="container">
            <div className="row">
              <div className="col-12 col-md-6">
                <div className="row padding-bottom">
                  <div className="col">
                    <h1>Cypherium<br /><span className="txt-blue">Ropsten Faucet</span></h1>
                  </div>
                </div>
                <div className="row padding-bottom">
                  <div className="col">
                    <h4>Instantly Get Ropsten Cypherium To Experiment On Test Net<span className="txt-blue">.</span></h4>
                  </div>
                </div>
                <div className="row padding-bottom">
                  <div className="col">
                    <ul className="features-list">
                      <li>Community Driven</li>
                      <li>Instant</li>
                      <li>Free</li>
                    </ul>
                  </div>
                </div>
                <div className="row">
                  <form onSubmit={this.handleSubmit} style={{width: "100%"}}>
                    <input className="fwd-input" style={{width: "65%", marginRight: "8px"}} placeholder="Your Cypherium Address" type="text" value={this.state.address} onChange={this.handleChange} />
                    <input className="fwd-btn" style={{width: "30%"}} type="submit" value="Get CPH!" />
                  </form>
                  <br />
                  <NotificationSystem ref="notificationSystem" />
                </div>
              </div>
              <div className="col-12 col-md-6">

              </div>
            </div>

          </div>
        </div>
    );
  }
}

export default App;
