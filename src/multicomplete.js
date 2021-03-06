(function(){
  "use strict";

  function MultiComplete(options){

    if (!(this instanceof MultiComplete)) {
      return new MultiComplete(options);
    }

    /**
     * Default options
     * @type {Object}
     */
    this.defaults = {
      fuzzyFilter : false
    };

    /**
     * merge options and defaults where user options will
     * override internal defaults
     * @type {Object}
     */
    this.opts = Object.assign({},  this.defaults, options);

    this.init();
  }

  MultiComplete.prototype = {
    
    init: function() {
      /**
       * Caching important DOM nodes when we need to use
       * straight up Javascript instead of jQuery
       */
      this.inputNode = document.querySelector(this.opts.input);

      var reqs = this.checkRequirements();
      if (!reqs) {
        return;
      }

      /**
       * Create a regex from the markers for the dataset
       * to indicate when to start filtering data
       */
      this.markersRegex = this.getMarkers();
      
      /**
       * Start listening for input keyup
       */
      this.inputNode.addEventListener('keyup', this.onInputKeyup.bind(this));
    },

    checkRequirements: function(){
      var result = true;
      if (!this.opts.input || !this.inputNode) {
        this.warn("input option not provided or element is missing");
        result = false;
      }
      if (!this.opts.datasets) {
        this.warn("no datasets provided or error loading them");
        result = false;
      }
      return result;
    },

    getMarkers: function(){
      var markers = "";
      for (var key in this.opts.datasets) {
        if ({}.hasOwnProperty.call(this.opts.datasets, key)) {
          markers += key;
        }
      }
      return this.makeRegex(markers);
    },

    /**
     * Takes the markers from the dataset object and creates a
     * regex to test input value and see if filtering needs to begin
     * Properly escapes any Regex-specific characters in case user
     * decides to use one of those as a marker
     * @param  {String} markers
     * @return {Regex}         
     */
    makeRegex: function(markers) {
      // some help from http://stackoverflow.com/a/5664273/395414
      var regString = markers.replace(/([()[{*+.$^\\|?])/g, "\\$1");
      return new RegExp("["+regString+"]", "i");
    },

    /**
     * Wrapper around new Error but possibly thinking about making
     * it just do console.warn instead, hence the function name
     * @param  {String} stuff The error/warn message
     * @return {Error}       
     */
    warn: function(stuff){
      throw new Error(stuff);
    },

    /**
     * Find the end of closest word given a starting index in a string
     * @param  {String} str   The full string to look through
     * @param  {Number} start The index in the string to start at
     * @return {Number}       The index of the next space
     */
    getNextSpace: function(str, start) {
      var returnIndex = str.substring(start, str.length).indexOf(" ");
      return (returnIndex < 0)? str.length : returnIndex + start;
    },

    /**
     * Find the beginning of the closest word in a string given a starting index    
     * @param  {String} str   The full string to look through
     * @param  {Number} end   The index in the string to start at
     * @return {Number}       The index of the beginning of the word 
     */
    getPrevSpace: function(str, end) {
      var returnIndex =  str.substring(0, end).lastIndexOf(" ");
      return returnIndex < 0 ? 0 : returnIndex + 1;
    },

    /**
     * Finds the starting and ending index of the closest word
     * to the cursor in the input. 
     * @param  {String} val       The whole current value of the input field
     * @param  {Number} cursorPos The current index of the cursor in the input
     * @return {Array}            Returns an array with the starting and ending values.  Array will always have length of 2
     */
    findPositions: function(val, cursorPos) {
      var startIndex;
      var endIndex;

      if (val[cursorPos] === " ") {
        endIndex = cursorPos;
      } else {
        endIndex = this.getNextSpace(val, cursorPos);
      }

      var leftChar = val[cursorPos - 1];
      if (leftChar === " ") {
        startIndex = cursorPos;
      } else {
        startIndex = this.getPrevSpace(val, cursorPos);
      }
      return [startIndex, endIndex];
    },

    testChar: function(char, word) {
      if (this.markersRegex.test(char)) {
        this.info.activeMarker = char;
        return this.beginFiltering(char, word);
      } else {
        return [];
      }
    },

    onInputKeyup : function(evt) {
      var val = this.inputNode.value;
      
      if (val) {
        this.handleValue(val);
        return;
      }

    },

    handleValue: function(val){
      var cursorPos = this.inputNode.selectionStart;
      var currentIndexes = this.findPositions(val, cursorPos);
      var currentWord = val.substring(currentIndexes[0],currentIndexes[1]);

      this.info = {
        start: currentIndexes[0], 
        end: currentIndexes[1],
        cursorPos: cursorPos,
        fullStr: currentWord,
        filterStr : currentWord.substr(1),
        val: val
      };

      var firstCharOfWord = currentWord.charAt(0);
      var filtered = this.testChar(firstCharOfWord, this.info.filterStr);
      
      this.publish(filtered);
    },

    /**
     * Sets which part of the dataset to look into to start filtereing
     * @param  {String} marker    The markey key in the dataset object
     * @param  {String} filterStr The string to use to as the filter seed
     * @return {Array}            An array of data
     */
    beginFiltering: function(marker, filterStr){
      if (!this.opts.datasets[marker]) {
        return []; 
      }
      var dataToFilter = this.opts.datasets[marker];
      var filteredData = this.getFilteredData(filterStr, this.opts.fuzzyFilter, dataToFilter);
      this.info.filteredData = filteredData;
      return filteredData;
    },

    /**
     * Reduce an array to only elements that match data given
     * @param  {String} filterStr   The string to look for in the data
     * @param  {Bool} fuzzyFilter   Whether to do exact or "fuzzy" matching
     * @param  {Array} fullArray    The target array to filter through
     * @return {Array}              newly filtered array
     */
    getFilteredData: function(filterStr, fuzzyFilter, fullArray) {
      
      return fullArray.filter(function(el){
        if (fuzzyFilter === true) {
          return el.indexOf(filterStr) >= 0;
        } else {
          return el.indexOf(filterStr) === 0;
        }
      });
    },

    publish: function(filteredData) {
      if (typeof this.subscribeCB === 'function') {
        this.subscribeCB(filteredData, this.info);
      }
    },

    onData: function(cb){
      this.subscribeCB = cb || function(){};
    }

  };

  /* global define */
  (function(root, factory) {
    if (typeof define === "function" && define.amd) {
      return define([], factory);
    } else if (typeof module === "object" && module.exports) {
      return module.exports = factory();
    } else {
      return root.MultiComplete = factory();
    }
  })(this, function() {
    return MultiComplete;
  });

}).call(this);