/* @flow */

import React from 'react';
import WrioDocumentActions from '../actions/WrioDocument.js';
import {replaceSpaces} from '../mixins/UrlMixin';
import {scrollTop, getElementOffset, StayOnTopElement} from './utils/domutils'

const MenuButton = ({active,name,url,hasLabel} : {active: boolean, name: string, hasLabel: boolean, url: string}) => {
    const className = active ? 'active' : '',
        click = () => WrioDocumentActions.article(name, replaceSpaces(name)),
        href = replaceSpaces(url || '#'+ name || "#");
    return (
        <li className={className}>
            <a href={href} onClick={click}
               data-toggle="offcanvas"
               style={active ? {color:"black"}:{}}
               className={active && "is-selected"}
            >
                <span className="cd-dot"></span>
                {hasLabel && <span className="cd-label">{name}</span>}
            </a>
        </li>
    );

};

type VNProps = {
    articleItems : Array<Object>,
    vertical : boolean
};

export class VerticalNav extends React.Component {
    props: VNProps;
    constructor(props: VNProps) {
        super(props);
        this.state = {items: this.props.articleItems};
    // $FlowFixMe
        this.handleScroll = this.handleScroll.bind(this);
    }
    componentWillReceiveProps(newProps : VNProps) {
        this.setState({items:newProps.articleItems});
    }
    componentDidMount() {
        window.addEventListener('scroll', this.handleScroll);
        this.handleScroll();
    }
    componentDidUnmount() {
        window.removeEventListener('scroll', this.handleScroll);
    }
    handleScroll() {
        this.props.articleItems.forEach((item,i) => {

            const articleChapter = document.getElementById(item.url.replace('#',''));
            const chapterSize = getElementOffset(articleChapter);
            // $FlowFixMe
            const windowHt = document.body.clientHeight;
            if ( ( chapterSize.top -  windowHt/2 < scrollTop() ) &&
                ( chapterSize.top + chapterSize.height - windowHt/2 > scrollTop() ) ) {
                //console.log("ACTIVE",i);
                this.setActive(i);
            }
        });
    }
    setActive(index : number) {
        const newItems = this.state.items.map((item,i) => {
            const newItem = item;
            item.active = index == i;
            return newItem;
        });
        this.setState({items:newItems});
    }
    render () {
        const vertical = this.props.vertical;
        return (<nav ref='nav'
                     id={vertical ? "cd-vertical-nav" : ""}
                     className={!vertical ? "contents visible-md-block visible-lg-block" : ""} >
            {!vertical && <h1>Contents</h1>}
            <ul>
                {this.state.items.map((i,key) => {
                    return (<MenuButton active={i.active}
                                        name={i.name}
                                        url={i.url}
                                        key={key}
                                        hasLabel ={!vertical}
                    />)
                })}
            </ul>
        </nav>);
    }
}

export class LeftNav extends StayOnTopElement {
    props: {
        articleItems:  Array<Object>
    };

    constructor(props : {articleItems:  Array<Object>}) {
        super(props);
        this.handleScroll = this.handleScroll.bind(this);
    }


    render () {
        return (<div ref="container" className="col-sm-3">
            <div ref="subcontainer"
                 id="sidebar"
                 className="col-sm-3">
                <div className="sidebar-margin">
                    <VerticalNav vertical={false} articleItems={this.props.articleItems}
                                 cls="contents visible-md-block visible-lg-block"/>
                </div>
            </div>
        </div>);
    }
}