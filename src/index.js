const prefix = '#token='
if (window.location.hash.startsWith(prefix)) {
  const token = window.location.hash.slice(prefix.length)
  window.localStorage.setItem('token', token)
}
import React, { Component } from 'react'
import { render } from 'react-dom'
import { Provider, connect } from 'react-redux'
import { HashRouter, Route, Switch, Redirect } from 'react-router-dom'
import { createStore, combineReducers, applyMiddleware } from 'redux'
import thunk from 'redux-thunk'
import axios from 'axios'
import moment from 'moment'

/* STORE */
const store = createStore(
  combineReducers({
    auth: (state = {}, action) => {
      if (action.type === 'SET_AUTH') {
        return action.auth
      }
      return state
    },
    logins: (state = [], action) => {
      if (action.type === 'SET_LOGINS') {
        return action.logins
      }
      return state
    },
  }),
  applyMiddleware(thunk)
)

const actions = {}
actions.attemptLogin = (credentials, history) => {
  return async (dispatch) => {
    const response = await axios.post('/api/sessions', credentials)
    const { token } = response.data
    window.localStorage.setItem('token', token)
    await dispatch(actions.attemptSessionLogin())
    history.push('/')
  }
}

actions.attemptSessionLogin = () => {
  return async (dispatch) => {
    const token = window.localStorage.getItem('token')
    if (token) {
      const auth = (
        await axios.get('/api/sessions', {
          headers: {
            authorization: token,
          },
        })
      ).data
      dispatch({ type: 'SET_AUTH', auth })
      dispatch(actions.fetchLogins())
    }
  }
}

actions.fetchLogins = () => {
  return async (dispatch) => {
    const token = window.localStorage.getItem('token')
    const logins = (
      await axios.get('/api/logins', {
        headers: {
          authorization: token,
        },
      })
    ).data
    dispatch({ type: 'SET_LOGINS', logins })
  }
}

actions.logout = () => {
  return async (dispatch) => {
    window.localStorage.removeItem('token')
    dispatch({ type: 'SET_AUTH', auth: {} })
  }
}

const Login = () => <a href="/github">Try Github</a>

/* Home */
const _Home = ({ auth, logins, logout }) => (
  <div>
    Home - Welcome {auth.github}
    <button onClick={logout}>Logout</button>
    <ul>
      {logins.map((login) => (
        <li key={login.id}>
          {moment(login.createdAt).format('MM/DD/YYYYY hh:mm:ss a')}
        </li>
      ))}
    </ul>
  </div>
)

const Home = connect(
  ({ auth, logins }) => {
    return { auth, logins }
  },
  (dispatch) => {
    return {
      logout: () => dispatch(actions.logout()),
    }
  }
)(_Home)

/* App */
class _App extends Component {
  componentDidMount() {
    this.props.attemptSessionLogin().catch((ex) => {
      if (ex.response.status === 401) {
        window.localStorage.removeItem('token')
      }
    })
  }
  render() {
    const { loggedIn } = this.props
    return (
      <div>
        <h1>Acme Login</h1>
        <HashRouter>
          <Switch>
            {loggedIn && <Route path="/" component={Home} exact />}
            {!loggedIn && <Route path="/login" component={Login} exact />}
            {!loggedIn && <Redirect to="/login" />}
            {loggedIn && <Redirect to="/" />}
          </Switch>
        </HashRouter>
      </div>
    )
  }
}

const App = connect(
  ({ auth }) => {
    return {
      loggedIn: !!auth.id,
    }
  },
  (dispatch) => {
    return {
      attemptSessionLogin: () => dispatch(actions.attemptSessionLogin()),
    }
  }
)(_App)

render(
  <Provider store={store}>
    <App />
  </Provider>,
  document.querySelector('#root')
)
