import React           from "react";
import _               from "lodash";
import Validator       from "validator";

export default class AtomicForm extends React.Component {

  constructor(props, context) {
    super(props, context);
    this.validateForm = this.validateForm.bind(this);
    this.allValid = this.allValid.bind(this);
    this.formData = this.formData.bind(this);
    this.getFormValue = this.getFormValue.bind(this);
    this.recursiveCloneChildren = this.recursiveCloneChildren.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
    this.state = this.getState();
  }

  getState() {
    if (this.props.getState) {
      return this.props.getState();
    } else {
      return {
        formData: this.props.initialData || {}
      }
    }
  }

  componentWillReceiveProps(nextProps) {
    if (_.isEmpty(this.state.formData) && !_.isEmpty(nextProps.initialData)) {
      this.setState({formData: nextProps.initialData});
    }
  }

  componentDidUpdate() {
    this.updateFormData();
  }

  updateFormData() {
    if (this.props.updateFormData) {
      return this.props.updateFormData(this.refs);
    } else {
      _.forEach(this.refs, function(ref, key) {
        var value = this.getFormValue(key);
        if (!_.isEmpty(value) || _.isBoolean(value)) {
          ref.getDOMNode().value = value;
        }
      }.bind(this));
    }
  }

  handleSubmit(e) {
    e.preventDefault();
    var formData = this.formData();
    var formValidation = this.validateForm(formData);
    if (this.allValid(formValidation)) {
      this.props.doSubmit(formData, formValidation);
    } else {
      this.props.afterValidation(formValidation);
      this.setState({formData:formData});
    }
  }

  allValid(formValidation) {
    return _.every(_.values(formValidation), function(v) { return v.isValid; });
  }

  validateForm(formData) {
    var result = {};
    _.forEach(this.refs, (val, key) => {
      var validators = this.refs[key].validate;
      result[key] = {};
      result[key].isValid = true;
      if(validators){
        if(_.isArray(validators)){
          _.forEach(validators, (validator) => {
            if(_.isFunction(validator.validate)){
              result[key].isValid = result[key].isValid && validator.validate(formData[key], formData);
            } else if (validator.validate == "isPresent") {
              result[key].isValid = result[key].isValid && !!formData[key];
            } else {
              var args = validator.args || [];
              result[key].isValid = result[key].isValid && Validator[validator.validate](formData[key], ...args);
            }
            if (!result[key].isValid) {
              result[key].message = result[key].message || [];
              result[key].message.push(validator.message || "");
            }
          }.bind(this));
        } else {
          console.log("Validators must be an Array for form key: " + key);
        }
      }
    }.bind(this));
    return result;
  }

  formData() {
    if (this.props.collectFormData) {
      return this.props.collectFormData(this.refs);
    } else {
      var formData = {};
      _.forEach(this.refs, (val, ref) => {
        var domNode = this.refs[ref];
        var keyArray = ref.split(".");
        if (keyArray.length > 1) {
          var firstKey = keyArray.shift();
          var data = {};
          data[keyArray.pop()] = domNode.value;
          while(keyArray.length > 0) {
            var temp = {};
            temp[keyArray.pop()] = data;
            data = temp;
          }
          formData[firstKey] = _.merge(data, formData[firstKey])
        } else {
          formData[ref] = domNode.value;
        }
      }.bind(this));
      return formData;
    }
  }

  getFormValue(ref) {
    return _.get(this.state.formData, ref);
  }

  // By default React will discard refs from the children. We override the behavior to include the refs
  // See: https://facebook.github.io/react/docs/clone-with-props.html
  recursiveCloneChildren(children) {
    return React.Children.map(children, child => {
      if(!_.isObject(child)) return child;
      var childProps = {};
      if(child.ref) {
        var valKey = child.props.type == "checkbox" || child.props.type == "radio" ? 'checked' : 'value';
        var oldOnChange = child.props.onChange;
        childProps.onChange = (e) => {
          if (typeof oldOnChange == 'function') {
            oldOnChange(e);
          }
          var formData = this.state.formData;
          _.set(formData, child.ref, this.refs[child.ref].getDOMNode()[valKey]);
          this.setState({formData: formData});
        };
        childProps.ref = child.ref;
      }
      childProps.children = this.recursiveCloneChildren(child.props.children);
      return React.cloneElement(child, childProps);
    })
  }

  render(){
    return <form onSubmit={(e) => {this.handleSubmit(e)} }>
      {this.recursiveCloneChildren(this.props.children)}
    </form>;
  }

}
