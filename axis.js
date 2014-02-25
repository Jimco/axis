/**
 * Axis 
 * 依赖 Underscore
 */
function Axis(){
  this.$$watchers = [];
  this.$$asyncQueue = [];
  this.$$postDigestQueue = [];
  this.$$phase = null;
}

Axis.prototype.$watch = function(watchFn, listenerFn, valueEq){
  var self = this;
  var watcher = {
      watchFn: watchFn,
      listenerFn: listenerFn || function(){},
      valueEq: !!valueEq
    };

  self.$$watchers.push(watcher);

  return function(){
    var index = self.$$watchers.indexOf(watcher);
    if(index >= 0){
      self.$$watchers.splice(index, 1);
    }
  }
}

Axis.prototype.$$digestOnce = function(){
  var self = this
    , dirty;

  _.forEach(this.$$watchers, function(watch){
    try{
      var newVal = watch.watchFn(self)
        , oldVal = watch.last;

      if(!self.$$areEqual(newVal, oldVal, watch.valueEq)){
        watch.listenerFn(newVal, oldVal, self);
        dirty = true;
      }
      watch.last = watch.valueEq ? _.cloneDeep(newVal) : newVal;
    }
    catch(e){
      (console.error || console.log)(e);
    }      
  });

  return dirty;
}

Axis.prototype.$digest = function(){
  var ttl = 10
    , dirty;

  this.$beginPhase('$digest');
  do{
    while(this.$$asyncQueue.length){
      try{
        var asyncTask = this.$$asyncQueue.shift();
        this.$eval(asyncTask.expression);
      }
      catch(e){
        (console.error || console.log)(e);
      }
    }

    dirty = this.$$digestOnce();
    if(dirty && !(ttl--)){
      throw '10 digest iterations reached';
    }
  }
  while(dirty);
  this.$clearPhase();

  while(this.$$postDigestQueue.length){
    try{
      this.$$postDigestQueue.shift()();
    }
    catch(e){
      (console.error || console.log)(e);
    }    
  }
}

Axis.prototype.$$areEqual = function(newVal, oldVal, valueEq){
  if(valueEq){
    return _.isEqual(newVal, oldVal);
  }
  else{
    // 在 Javascript 里 NaN 不等于自身，做显示处理
    return newVal === oldVal ||
      (typeof newVal === 'number' && typeof oldVal === 'number' && isNaN(newVal) && isNaN(oldVal));
  }
}

Axis.prototype.$eval = function(expr, locals){
  return expr(this, locals);
}

Axis.prototype.$apply = function(expr){
  try{
    this.beginPhase('$apply');
    return this.$eval(expr);
  }
  finally{
    this.$clearPhase();
    this.$digest();
  }
}

Axis.prototype.$evalAsync = function(expr){
  var self = this;
  
  if(!self.$$phase && !self.$$asyncQueue.length){
    setTimeout(function(){
      if(self.$$asyncQueue.length){
        self.$digest();
      }
    }, 0);
  }

  self.$$asyncQueue.push({scope: this, expression: expr});
}

Axis.prototype.$beginPhase = function(phase){
  if(this.$$phase){
    throw this.$$phase + ' already in progress.';
  }

  this.$$phase = phase;
}

Axis.prototype.$clearPhase = function(){
  this.$$phase = null;
}

Axis.prototype.$$postDigest = function(fn){
  this.$$postDigestQueue.push(fn);
}